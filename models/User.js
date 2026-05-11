import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { countries } from "../constants/countries.js";
import { generateUniqueSlug } from "../utils/slugify.js";

const userSchema = mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(10),
    },
    name: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    placeOfBirth: {
      type: String,
      required: true,
    },
    idType: {
      type: String,
      enum: ["CIN", "Passport"],
      required: true,
    },
    idNumber: {
      number: {
        type: String,
        required: true,
      },
      countryCode: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 2,
        enum: countries.map((c) => c.code), // Ensure It's a valid country code from the list of countries
      },
      issueDate: {
        type: Date,
        required: true,
      },
      issuePlace: {
        type: String,
        required: true,
      },
    },
    password: {
      type: String,
      required: true,
    },
    verificationCode: {
      // OTP Code
      type: String,
    },
    verificationCodeExpires: {
      // OTP Code expiration
      type: Date,
    },
    status: {
      // Account status
      type: String,
      enum: ["Pending", "Active", "Inactive", "Blocked"],
      default: "Pending",
    },
    resendCount: {
      // Number of times the user has requested to resend the OTP code
      type: Number,
      default: 0,
    },
    resendDate: {
      // Date of the last OTP code resend request to control: 3 resends per day
      type: Date,
      default: Date.now,
    },
    mustResetPassword: {
      type: Boolean,
      default: true, // all new users must reset their password on first login
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
      required: true,
    },
    joinDate: {
      // UTC Join Date to the platform (No timezone issues)
      type: Date,
      required: true,
      default: Date.now,
    },
    employment: {
      // Employment contract details
      contractType: {
        type: String,
        enum: ["CDI", "INTERNSHIP"],
        required: true,
        default: "CDI",
      },
      contractJoinDate: {
        type: Date,
        required: true,
      },
      contractEndDate: {
        // For Internship contracts, the end date of the contract. For CDI, this will be null 
        type: Date,
        default: null,
      },
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    profileImageURL: {
      type: String,
      default: "",
    },
    profileImagePublicId: {
      // Cloudinary public ID of each profileimage used for deletion
      type: String,
      default: "",
    },
    bio: {
      type: String,
    },
    leaveBalances: [
      {
        typeId: mongoose.Schema.Types.ObjectId,
        remainingDays: {
          // Represents the remaining leave days for this leave type
          type: Number,
          min: 0,
          default: 0,
        },
      },
    ],
    socialStatus: {
      type: String,
      enum: ["Married", "Not Married"],
      default: "Not Married",
    },
    isHeadOfFamily: {
      // Whether the employee is considered the head of the family for tax deduction purposes (e.g., for IRPP family deduction in Tunisia)
      type: Boolean,
      default: false,
    },
    children: [
      {
        dateOfBirth: {
          type: Date,
          required: true,
        },
        isStudent: {
          type: Boolean,
          default: false,
        },
        hasScholarship: {
          type: Boolean,
          default: false,
        },
        isDisabled: {
          type: Boolean,
          default: false,
        },
      },
    ],
    projectsCount: {
      // Number of active projects the user is currently involved in
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRole",
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    supervisor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    faceDescriptors: {
      type: [[Number]],
      default: [],
    },
    faceEnrolled: {
      type: Boolean,
      default: false,
    },
    faceEnrollmentPromptRequired: {
      type: Boolean,
      default: true,
    },
    salary: {
      // Base salary for the payroll calculations
      base: {
        // Base salary amount: Fixed monthly salary of the employee
        type: Number,
        default: 0,
        min: 0,
      },
      currency: {
        type: String,
        default: "DT",
      },
    },
  },
  { timestamps: true },
);

// Index for the ID number uniqueness
userSchema.index(
  { "idNumber.number": 1, "idNumber.countryCode": 1 },
  { unique: true, sparse: true },
);

userSchema.pre("save", async function () {
  if (this.isModified("name") || this.isModified("lastName") || !this.slug) {
    this.slug = await generateUniqueSlug(
      this.constructor,
      `${this.name}-${this.lastName}`
    );
  }
});

export default mongoose.model("User", userSchema);
