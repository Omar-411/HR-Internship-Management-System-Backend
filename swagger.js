import swaggerJsdoc from "swagger-jsdoc";

// Base URL used by Swagger for curl and "Try it out".
// - In development → http://localhost:3000
// - In production  → https://hr-internship-management-system-backend.onrender.com
// Can be overridden with SWAGGER_SERVER_URL if needed.
const swaggerServerUrl =
  process.env.SWAGGER_SERVER_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://hr-internship-management-system-backend.onrender.com"
    : "http://localhost:3000");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HRcoM API",
      version: "1.0.0",
      description:
        "This is the API documentation for HRcoM, the DotJcoM's HR and Internship Management System!",
    },
    servers: [
      {
        url: swaggerServerUrl,
        description: "API server",
      },
    ],
    components: {
      schemas: {
        // ================== User Schema ==================
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each user.",
            },
            name: { type: "string", description: "First name of the user." },
            lastName: { type: "string", description: "Last name of the user." },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: { type: "string", description: "Address of the user." },
            joinDate: {
              type: "string",
              format: "date-time",
              description: "Date when the user joined the company.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user in the company.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user (primes).",
            },
            profileImageURL: {
              type: "string",
              description: "URL of the user's profile image (Cloudinary URL).",
            },
            bio: { type: "string", description: "Biography of the user." },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            status: {
              type: "string",
              enum: ["Pending", "Active", "Inactive", "Blocked"],
              description: "The account status of the user.",
            },
            isAvailable: {
              type: "boolean",
              description:
                "Indicates if the user is available to take on more projects.",
            },
            role_id: { type: "string", description: "ID of the user's role." },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Date when the user was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Date when the user was last updated.",
            },
          },
        },

        // ================== User Request Schemas ==================
        CreateUserRequest: {
          type: "object",
          required: [
            "name",
            "lastName",
            "email",
            "address",
            "phoneNumber",
            "position",
            "socialStatus",
            "role_id",
            "department_id",
          ],
          properties: {
            name: {
              type: "string",
              description: "First name of the user.",
            },
            lastName: {
              type: "string",
              description: "Last name of the user.",
            },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: {
              type: "string",
              description: "Address of the user.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user.",
            },
            bio: {
              type: "string",
              description: "Biography of the user.",
            },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            isActive: {
              type: "boolean",
              description: "Indicates if the user is active.",
            },
            isAvailable: {
              type: "boolean",
              description: "Indicates if the user is available.",
            },
            role_id: {
              type: "string",
              description: "ID of the user's role.",
            },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
          },
        },

        UpdateUserRequest: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "First name of the user.",
            },
            lastName: {
              type: "string",
              description: "Last name of the user.",
            },
            email: {
              type: "string",
              description: "Email address of the user.",
            },
            address: {
              type: "string",
              description: "Address of the user.",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number of the user.",
            },
            position: {
              type: "string",
              description: "Position of the user.",
            },
            bonus: {
              type: "number",
              description: "Bonus amount for the user.",
            },
            profileImageURL: {
              type: "string",
              description: "URL of the user's profile image.",
            },
            bio: {
              type: "string",
              description: "Biography of the user.",
            },
            leaveBalance: {
              type: "number",
              description: "Leave balance for the user.",
            },
            socialStatus: {
              type: "string",
              enum: ["Married", "Not Married"],
              description: "Social status of the user.",
            },
            hasChildren: {
              type: "boolean",
              description: "Indicates if the user has children.",
            },
            nbOfChildren: {
              type: "number",
              description: "Number of children the user has.",
            },
            isActive: {
              type: "boolean",
              description: "Indicates if the user is active.",
            },
            isAvailable: {
              type: "boolean",
              description: "Indicates if the user is available.",
            },
            role_id: {
              type: "string",
              description: "ID of the user's role.",
            },
            department_id: {
              type: "string",
              description: "ID of the user's department.",
            },
            supervisor_id: {
              type: "string",
              nullable: true,
              description: "ID of the user's supervisor.",
            },
          },
        },


        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              description: "User email",
            },
            password: {
              type: "string",
              description: "User password",

              description: "Email address of the user.",
            },
            password: {
              type: "string",
              description: "Password of the user.",
            },
          },
        },

        // ================== UserRole Schema ==================
        UserRole: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each user role.",
            },
            name: { type: "string", description: "Name of the role." },
            description: {
              type: "string",
              description: "Description of the role.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the role was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the role was last updated.",
            },
          },
        },

        // ================== User Role Request Schemas ==================
        CreateUserRoleRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Name of the user role." },
            description: {
              type: "string",
              description: "Description of the user role.",
            },
          },
        },

        UpdateUserRoleRequest: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the user role." },
            description: {
              type: "string",
              description: "Description of the user role.",
            },
          },
        },

        // ================== Department Schemas ==================
        Department: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each department.",
            },
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the department was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the department was last updated.",
            },
          },
        },

        // ================== Department Request Schemas ==================
        CreateDepartmentRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
          },
        },

        UpdateDepartmentRequest: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the department." },
            description: {
              type: "string",
              description: "Description of the department.",
            },
          },
        },

        // ================== Audit Log Schemas ==================
        AuditLog: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each audit log.",
            },
            admin_id: {
              type: "string",
              description: "ID of the admin who performed the action.",
            },
            action: {
              type: "string",
              description: "The Action performed in the audit log.",
              enum: [
                "CREATE_USER",
                "UPDATE_USER",
                "DELETE_USER",
                "TOGGLE_STATUS",
                "CREATE_DEPARTMENT",
                "UPDATE_DEPARTMENT",
                "DELETE_DEPARTMENT",
                "CREATE_ROLE",
                "UPDATE_ROLE",
                "DELETE_ROLE",
                "UPLOAD_IMAGE",
              ],
            },
            target_type: {
              type: "string",
              description: "The target entity type.",
              enum: ["User", "Department", "UserRole"],
            },
            target_id: {
              type: "string",
              description: "The ID of the target entity.",
            },
            target_name: {
              type: "string",
              description: "The target entity name.",
            },
            details: {
              type: "object",
              description: "The audit log details.",
            },
            ipAddress: {
              type: "string",
              description: "IP address from which the action was performed.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the document was created.",
            },
          },
        },

        // ================== Document Schemas ==================
        Document: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each document.",
            },
            title: { type: "string", description: "Title of the document." },
            format: {
              type: "string",
              description: "Format of the document.",
              enum: ["PDF", "Word", "Excel", "JPEG", "PNG", "WEBP", "Other"],
            },
            size: {
              type: "number",
              description: "Size of the document in bytes.",
            },
            uploadDate: {
              type: "string",
              format: "date-time",
              description: "Date when the document was uploaded.",
            },
            fileURL: {
              type: "string",
              description: "Cloudinary URL of the document.",
            },
            isConfidential: {
              type: "boolean",
              description: "Indicates if the document is confidential.",
            },
            documentType_id: {
              type: "string",
              description: "ID of the document type.",
            },
            user_id: {
              type: "string",
              description: "ID of the user to whom the document belongs.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the document was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the document was last updated.",
            },
          },
        },

        // ================== DocumentType Schemas ==================
        DocumentType: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique identifier for each document type.",
            },
            name: { type: "string", description: "Name of the document type." },
            description: {
              type: "string",
              description: "Description of the document type.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the document type was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description:
                "Timestamp of when the document type was last updated.",
            },
          },
        },

        // ================== Timetable Schemas ==================
        Timetable: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique Identifier for each timetable entry.",
            },
            userId: {
              type: "string",
              description:
                "ID of the user to whom the timetable entry belongs.",
            },
            date: {
              type: "string",
              format: "date-time",
              description: "The date of the timetable entry.",
            },
            type: {
              type: "string",
              enum: [
                "Morning Shift",
                "Evening Shift",
                "Full-time Shift",
                "Day Off",
                "Special Shift",
              ],
              description: "The type of the timetable entry.",
            },
            location: {
              type: "string",
              enum: ["Remote", "Onsite"],
              description: "The location of the timetable entry.",
            },
            color: {
              type: "string",
              description:
                "The color associated with the timetable entry (for calendar display).",
            },
            duration: {
              type: "string",
              description:
                "The duration of the shift (e.g., '8 hours', '4 hours').",
            },
            isLocked: {
              type: "boolean",
              description:
                "Indicates if the timetable entry is locked (cannot be edited). The user cannot edit his shift. Only an admin can edit shifts.",
            },
            hasFeedback: {
              type: "boolean",
              description: "Indicates if the timetable entry has feedback.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the timetable entry was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the timetable entry was last updated.",
            },
          },
        },

        // ================== Attendance Schemas ==================
        Attendance: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique Identifier for each attendance record.",
            },
            userId: {
              type: "string",
              description:
                "ID of the user to whom the attendance record belongs.",
            },
            date: {
              type: "string",
              format: "date-time",
              description: "The date of the attendance record.",
            },
            checkInTime: {
              type: "string",
              description: "The check-in time for the attendance record.",
            },
            checkOutTime: {
              type: "string",
              description: "The check-out time for the attendance record.",
            },
            status: {
              type: "string",
              enum: ["present", "late", "absent", "leave"],
              description: "The attendance status for the record.",
            },
            location: {
              type: "string",
              enum: ["Remote", "Onsite"],
              description: "The location of the attendance (Remote or Onsite).",
            },
            notes: {
              type: "string",
              description:
                "Additional notes for the attendance record (e.g., reason for being late or absent).",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the attendance record was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the attendance record was last updated.",
            },
          },
        },

        // ================== Leave Type Schemas ==================
        LeaveType: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique Identifier for each leave type.",
            },
            name: {
              type: "string",
              description: "Name of the leave type.",
            },
            description: {
              type: "string",
              description: "Description of the leave type.",
            },
            isPaid: {
              type: "boolean",
              description: "Indicates if the leave type is paid or unpaid.",
            },
            status: {
              type: "string",
              enum: ["Active", "Archived"],
              description: "Status of the leave type (for archive/restore functionality).",
            },
            createdAt: {
              type: "string",
              format: "date-time",  
              description: "Timestamp of when the leave type was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the leave type was last updated.",
            },
          },
        },

        // ================== Leave Request Schemas ==================
        LeaveRequest: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Unique Identifier for each leave request.",
            },
            employeeId: {
              type: "string",
              description: "ID of the employee (Employee, Intern, Supervisor) who made the leave request.",
            },
            supervisorId: {
              type: "string",
              description: "ID of the supervisor who will approve/reject the leave request (for employees/Interns).",
            },
            reviewedBy: { 
              type: "string",
              nullable: true,
              description: "ID of the admin who marked the leave request under review.",
            },
            typeId: {
              type: "string",
              description: "ID of the leave type being requested.",
            },
            startDate: {
              type: "string",
              format: "date-time",
              description: "Start date of the requested leave.",
            },
            endDate: {
              type: "string",
              format: "date-time",
              description: "End date of the requested leave.",
            },
            reason: {
              type: "string",
              description: "Reason provided by the user for the leave request.",
            },
            status: {
              type: "string",
              enum: [
                "Pending Supervisor Approval",
                "Under Supervisor Review",
                "Rejected by Supervisor",
                "Pending Admin Approval",
                "Under Admin Review",
                "Rejected by Admin",
                "Approved",
              ],
              description: "Status of the leave request.",
            },
            comments: {
              type: "string",
              description: "Comments from the approver regarding the leave request.",
            },
            attachmentURL: {
              type: "string",
              description: "Cloudinary URL of the attachment for the leave request.",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the leave request was created.",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the leave request was last updated.",
            },
          },
        },
      },

      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
