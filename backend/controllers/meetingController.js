import * as meetingService from "../services/meetingService.js";

// Get all meeting by project
export const getAllMeetingsOfProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await meetingService.getAllMeetingsOfProject(
      projectId,
      req.user,
      req.query
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a meeting by Id
export const getMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const result = await meetingService.getMeetingById(
      meetingId,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Plan a meeting
export const createMeeting = async (req, res, next) => {
  try {
    const result = await meetingService.createMeeting(req.body, req.user);
    
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Update a meeting
export const updateMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const result = await meetingService.updateMeeting(
      meetingId,
      req.body,
      req.user,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Cancel a meeting
export const cancelMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const result = await meetingService.cancelMeeting(meetingId, req.user);

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Respond to a meeting invitation
export const respondToMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { status, reason } = req.body;

    const result = await meetingService.respondToMeeting(
      meetingId,
      req.user,
      status,
      reason,
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
