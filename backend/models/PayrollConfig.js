import mongoose from "mongoose";

const payrollConfigSchema = new mongoose.Schema(
  {
    year: {
      // The year for which this payroll configuration applies (e.g., 2026)
      type: Number,
      required: true,
    },
    isActive: {
      // Whether this payroll configuration is currently active and should be used for payroll calculations
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    cnss: {
      rate: {
        type: Number,
        default: 0.0968, // 9.68% according to the current regulations in Tunisia (Loi de finances 2026)
      },
      ceiling: {
        type: Number,
        default: 5000, // The maximum salary subject to CNSS contributions according to the current regulations in Tunisia
      },
    },
    css: {
      // CSS = Contribution Sociale de Solidarité
      rate: {
        type: Number,
        default: 0.05, // 5% according to the current regulations in Tunisia
      },
      threshold: {
        type: Number,
        default: 5000, // The threshold for CSS contributions according to the current regulations in Tunisia
      },
    },
    irpp: {
      // IRPP = Impôt sur le Revenu des Personnes Physiques (Income Tax)
      brackets: {
        type: [
          {
            limit: { type: Number, default: null },
            rate: { type: Number },
            _id: false,
          },
        ],
        // Standard Tunisian IRPP brackets (Loi de finances 2026)
        default: [
          { limit: 5000,  rate: 0    },
          { limit: 20000, rate: 0.26 },
          { limit: 30000, rate: 0.28 },
          { limit: 50000, rate: 0.32 },
          { limit: null,  rate: 0.35 },
        ],
      },
      fraisPro: {
        // Frais professionnels
        rate: {
          type: Number,
          default: 0.1, // 10% of the taxable income according to the current regulations in Tunisia
        },
        ceiling: {
          type: Number,
          default: 2000, // The maximum amount of professional expenses that can be deducted according to the current regulations in Tunisia
        },
      },
      family: {
        spouse: {
          // The deduction amount for having a spouse
          type: Number,
          default: 300,
        },
        perChild: {
          // The deduction amount for each dependent child (per year)
          type: Number,
          default: 100,
        },
        studentChild: {
          // The deduction amount for each dependent child who is a student (per year)
          type: Number,
          default: 1000,
        },
        disabledChild: {
          // The deduction amount for each dependent child who is disabled (per year)
          type: Number,
          default: 1200,
        },
        maxChildren: {
          // The maximum number of children that can be considered for the family deduction
          type: Number,
          default: 4,
        },
      },
    },
    payroll: {
      standardMonthlyHours: {
        type: Number,
        default: 173,
      },
    },
  },
  {
    timestamps: true,
  },
);

payrollConfigSchema.pre("save", function () {
  if (this.irpp?.brackets) {
    this.irpp.brackets.sort(
      (a, b) => (a.limit ?? Infinity) - (b.limit ?? Infinity)
    );
  }
});

export default mongoose.model("PayrollConfig", payrollConfigSchema);
