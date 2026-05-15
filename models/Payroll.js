import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "DT",
    },
    baseSalary: {
      // The agreed monthly salary for the employee
      type: Number,
      required: true,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    workedDays: {
      type: Number,
      default: 0,
    },
    earnings: {
      bonuses: [
        {
          code: {
            type: String,
          },
          name: {
            type: String,
          },
          amount: {
            type: Number,
          },
          isTaxable: {
            type: Boolean,
          },
        },
      ],
      allowances: [
        {
          code: {
            type: String,
          },
          name: {
            type: String,
          },
          amount: {
            type: Number,
          },
          isTaxable: {
            type: Boolean,
          },
        },
      ],
      overtime: {
        amount: {
          type: Number,
          default: 0,
        },
        hours: {
          type: Number,
          default: 0,
        },
      },
      totals: {
        bonuses: {
          type: Number,
        },
        allowancesTaxable: {
          type: Number,
        },
        allowancesNonTaxable: {
          type: Number,
        },
      },
      total: {
        type: Number,
      },
    },
    family: {
      spouse: {
        eligible: {
          type: Boolean,
        },
        amount: {
          type: Number,
        },
      },
      children: [
        {
          category: {
            type: String, // "normal" | "student" | "disabled"
          },
          amount: {
            type: Number,
          },
        },
      ],
      total: {
        type: Number,
      },
    },
    cnssBase: {
      // The portion of the salary subject to CNSS contributions (capped at the CNSS ceiling)
      type: Number,
    },
    taxableIncome: {
      // Income before IRPP
      type: Number,
    },
    netTaxableIncome: {
      // Income after IRPP
      type: Number,
    },
    fraisProfessionnels: {
      type: Number,
    },
    deductions: {
      cnss: {
        type: Number,
      },
      css: {
        type: Number,
      },
      irpp: {
        // Income tax deduction
        type: Number,
      },
      absences: {
        // Deductions for absences
        type: Number,
      },
      lateArrivals: {
        // Deductions for late arrivals
        type: Number,
      },
      unpaidLeave: {
        // Deductions for unpaid leaves
        type: Number,
      },
      total: {
        // Total deductions
        type: Number,
        required: true,
      },
    },
    grossSalary: {
      type: Number,
      required: true,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    configSnapshot: {
      // A snapshot of the payroll configuration (CNSS, CSS, IRPP) at the time of payroll generation to ensure historical accuracy
      year: {
        type: Number,
        required: true,
      },
      cnss: {
        rate: {
          type: Number,
        },
        ceiling: {
          type: Number,
        },
      },
      css: {
        rate: {
          type: Number,
        },
        threshold: {
          type: Number,
        },
      },
      irpp: {
        brackets: [
          {
            limit: {
              type: Number,
            },
            rate: {
              type: Number,
            },
          },
        ],
        fraisPro: {
          rate: {
            type: Number,
          },
          ceiling: {
            type: Number,
          },
        },
      },
      payroll: {
        standardMonthlyHours: {
          type: Number,
        },
      },
    },
    status: {
      type: String,
      enum: ["draft", "validated", "paid"],
      default: "draft",
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    validatedAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    recalculationRequired: {
      // Flag to indicate if the payroll needs to be recalculated due to changes in attendance, shifts, bonuses/allowances
      type: Boolean,
      default: false,
    },
    recalculationMessage: {
      // Reason for recalculation (e.g., "Attendance Change", "Bonus Update", etc.)
      type: String,
      default: null,
    },
    recomputedAt: {
      // Timestamp of the last recomputation
      type: Date,
      default: null,
    },
    recomputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Ensure one payroll per employee per month
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payroll", payrollSchema);
