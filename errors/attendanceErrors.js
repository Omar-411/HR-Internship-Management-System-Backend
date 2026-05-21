export const errors = {
  ATTENDANCE_RECORD_NOT_FOUND: {
    message: "Attendance record not found",
    code: 404,
    errorCode: "ATTENDANCE_RECORD_NOT_FOUND",
    suggestion: "Please check the validity of the attendance record.",
  },
  INVALID_EXPORT_FORMAT: {
    message: "Invalid export format",
    code: 400,
    errorCode: "INVALID_EXPORT_FORMAT",
    suggestion: "Please use a valid export format (csv or excel).",
  },
  FACE_NOT_ENROLLED: {
    message: "Face not enrolled",
    code: 403,
    errorCode: "FACE_NOT_ENROLLED",
    suggestion: "Please enroll your face before your check-in.",
  },
  START_END_DATE_REQUIRED: {
    message: "StartDate and endDate are required for custom attendance records",
    code: 400,
    errorCode: "START_END_DATE_REQUIRED",
    suggestion: "Please provide both startDate and endDate for custom attendance records.",
  },
};
