import * as resignationService from "../services/resignationService.js";
import * as resignationStatsService from "../services/analytics/resignationStatsService.js";

// Get resignation statuses (For the frontend)
export const getResignationStatuses = async (req, res, next) => {
  try {
    const result = await resignationService.getResignationStatuses();
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get resignation KPIs for the admin dashboard in the Resignation section
export const getResignationKPIs = async (req, res, next) => {
  try {
    const result = await resignationStatsService.getResignationKPIs();

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a single resignation request by ID
export const getResignationById = async (req, res, next) => {
  try {
    const resignationId = req.params.id;

    const result = await resignationService.getResignationById(
      resignationId,
      req.user,
    );
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get all resignation requests (Admin only)
export const getAllResignations = async (req, res, next) => {
  try {
    const queryParams = req.query;

    const result = await resignationService.getAllResignations(queryParams);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get the current user's own resignation request
export const getMyResignation = async (req, res, next) => {
  try {
    const result = await resignationService.getMyResignation(req.user.id);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Submit a resignation request
export const submitResignation = async (req, res, next) => {
  try {
    const employeeId = req.user.id;

    const result = await resignationService.submitResignation(
      employeeId,
      req.body,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a resignation request
export const updateResignation = async (req, res, next) => {
  try {
    const resignationId = req.params.id;
    const employeeId = req.user.id;

    const result = await resignationService.updateResignation(
      resignationId,
      employeeId,
      req.body,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Request clarification on a resignation request (Admin only)
export const requestClarification = async (req, res, next) => {
  try {
    const resignationId = req.params.id;
    const adminId = req.user.id;

    const result = await resignationService.requestClarification(
      resignationId,
      adminId,
      req.body,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Respond to a clarification request
export const respondToClarification = async (req, res, next) => {
  try {
    const resignationId = req.params.id;
    const employeeId = req.user.id;

    const result = await resignationService.respondToClarification(
      resignationId,
      employeeId,
      req.body,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Approve a resignation request (Admin Only)
export const approveResignation = async (req, res, next) => {
  try {
    const resignationId = req.params.id;
    const adminId = req.user.id;

    const result = await resignationService.approveResignation(
      resignationId,
      adminId,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Start the exit process (Admin Only)
export const startExitProcess = async (req, res, next) => {
  try {
    const resignationId = req.params.id;
    const adminId = req.user.id;

    const result = await resignationService.startExitProcess(
      resignationId,
      adminId,
      req.ip,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
