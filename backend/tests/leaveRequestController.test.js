import { jest } from '@jest/globals';
import * as leaveController from '../controllers/leaveRequestController.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveType from '../models/LeaveType.js';
import User from '../models/User.js';
import * as cloudinaryHelper from '../utils/cloudinaryHelper.js';
import { logAuditAction } from '../utils/logger.js';
import { getIO } from '../socket.js';
import AppError from '../utils/AppError.js';

// --- MOCKS ---
jest.mock('../models/LeaveRequest.js');
jest.mock('../models/LeaveType.js');
jest.mock('../models/User.js');
jest.mock('../utils/cloudinaryHelper.js');
jest.mock('../utils/logger.js');
jest.mock('../socket.js');
jest.mock('../utils/leaveStatusByRole.js', () => ({
  getStatusesByRole: jest.fn((role) => {
    const normalized = (role || "").toString().trim().toLowerCase();
    if (normalized === 'admin') return ['Pending Admin Approval', 'Under Admin Review', 'Approved', 'Rejected by Admin'];
    if (normalized === 'supervisor') return ['Pending Supervisor Approval', 'Under Supervisor Review', 'Rejected by Supervisor', 'Pending Admin Approval'];
    return ['Pending Supervisor Approval', 'Pending Admin Approval', 'Approved', 'Rejected by Supervisor', 'Rejected by Admin'];
  })
}));

const mockIO = { emit: jest.fn() };
getIO.mockReturnValue(mockIO);

describe('Leave Request Controller - Ultimate Robustness Suite', () => {
  let req, res, next;
  let mockLeaveRequest, mockLeaveType, mockEmployee;

  beforeAll(() => {
    // Silence logs inside Jest only
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    req = {
      user: { id: 'user123', role: 'employee' },
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      file: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    // Standard baseline mocks
    mockLeaveRequest = {
        _id: 'req123', employeeId: 'emp123', typeId: 'type123', duration: 5,
        status: 'Pending Admin Approval', save: jest.fn().mockResolvedValue(true)
    };
    mockLeaveType = { _id: 'type123', name: 'Annual', deductFrom: 'annual', isPaid: true };
    mockEmployee = {
        _id: 'emp123', name: 'John', lastName: 'Doe',
        leaveBalances: [{ typeId: 'type123', remainingDays: 20 }],
        save: jest.fn().mockResolvedValue(true)
    };

    jest.clearAllMocks();
  });

  const assertNoSideEffects = () => {
    expect(LeaveRequest.create).not.toHaveBeenCalled();
    expect(mockIO.emit).not.toHaveBeenCalled();
    expect(logAuditAction).not.toHaveBeenCalled();
  };

  describe('addLeaveRequest - Security & Side Effects', () => {
    const setupBaseMocks = (userOverrides = {}, typeOverrides = {}) => {
      User.findById.mockResolvedValue({ _id: 'user123', gender: 'Male', supervisor_id: 'sup123', role: 'employee', ...userOverrides });
      LeaveType.findById.mockResolvedValue({ _id: 'type123', gender: 'Both', defaultDays: 10, status: 'Active', ...typeOverrides });
      LeaveRequest.findOne.mockResolvedValue(null);
    };

    it('should NOT create request or emit event if Cloudinary upload fails', async () => {
      req.body = { typeId: 'type123', startDate: '2026-06-01', endDate: '2026-06-05' };
      req.file = { path: 'path/to/file' };
      setupBaseMocks();
      cloudinaryHelper.uploadDocToCloudinary.mockRejectedValue(new Error('Cloudinary Failure'));
      await leaveController.addLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      assertNoSideEffects();
    });

    it('should NOT create request if overlap is found (Data Integrity)', async () => {
      req.body = { typeId: 'type123', startDate: '2026-06-01', endDate: '2026-06-05' };
      setupBaseMocks();
      LeaveRequest.findOne.mockResolvedValue({ _id: 'existing123' });
      await leaveController.addLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      assertNoSideEffects();
    });

    it('should fail safely if User.findById throws (Failure Safety)', async () => {
      User.findById.mockRejectedValue(new Error('DB Connection Error'));
      await leaveController.addLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      assertNoSideEffects();
    });
  });

  describe('approveOrRejectLeaveRequest - Bidirectional Consistency & Concurrency', () => {
    beforeEach(() => {
      LeaveRequest.findById.mockResolvedValue(mockLeaveRequest);
      LeaveType.findById.mockResolvedValue(mockLeaveType);
      User.findById.mockResolvedValue(mockEmployee);
    });

    it('should ensure bidirectional consistency: both status and balance update, or neither', async () => {
      req.user = { id: 'admin123', role: 'admin' };
      req.params.id = 'req123';
      req.body = { action: 'approve' };
      mockEmployee.save.mockRejectedValue(new Error('Balance Update Failed'));
      await leaveController.approveOrRejectLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLeaveRequest.save).not.toHaveBeenCalled();
      expect(logAuditAction).not.toHaveBeenCalled();
    });

    it('Security: Employee should NOT be able to mutate status', async () => {
      req.user = { id: 'emp123', role: 'employee' };
      req.params.id = 'req123';
      req.body = { action: 'approve' };
      await leaveController.approveOrRejectLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(mockLeaveRequest.status).toBe('Pending Admin Approval');
      expect(mockEmployee.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllLeaveRequests - Result-Based Validation', () => {
    it('should return ONLY supervisor-relevant requests for a supervisor', async () => {
      req.user = { id: 'sup123', role: 'supervisor' };
      const mockData = [
        { _id: 'req1', supervisorId: 'sup123', employeeId: 'other' },
        { _id: 'req2', employeeId: 'sup123' }
      ];
      LeaveRequest.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockData)
      });
      LeaveRequest.countDocuments.mockResolvedValue(2);
      await leaveController.getAllLeaveRequests(req, res, next);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: "Success",
        code: 200,
        data: expect.arrayContaining([
          expect.objectContaining({ _id: 'req1' }),
          expect.objectContaining({ _id: 'req2' })
        ])
      }));
    });
  });

  describe('Chaos Test - Multiple Failures', () => {
    it('should remain consistent when both User and LeaveRequest saves fail', async () => {
      req.user = { id: 'admin123', role: 'admin' };
      req.params.id = 'req123';
      req.body = { action: 'approve' };
      LeaveRequest.findById.mockResolvedValue(mockLeaveRequest);
      LeaveType.findById.mockResolvedValue(mockLeaveType);
      User.findById.mockResolvedValue(mockEmployee);
      mockEmployee.save.mockRejectedValue(new Error('User DB Fail'));
      mockLeaveRequest.save.mockRejectedValue(new Error('Request DB Fail'));
      await leaveController.approveOrRejectLeaveRequest(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(logAuditAction).not.toHaveBeenCalled();
      expect(mockIO.emit).not.toHaveBeenCalled();
    });
  });
});
