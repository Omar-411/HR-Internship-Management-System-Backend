import { errors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";
import { validateDefaultAmount } from "../validators/allowanceTypeValidators.js";

// Validate the payroll configuration rate
export const validateRate = (rate) => {
  if (typeof rate !== "number" || rate < 0 || rate > 1) {
    throw new AppError(
      errors.INVALID_RATE.message,
      errors.INVALID_RATE.code,
      errors.INVALID_RATE.errorCode,
      errors.INVALID_RATE.suggestion,
    );
  }
};

// Validate the payroll configuration data
export const validatePayrollConfig = (data) => {
  // 1. Year
  if (!data.year || typeof data.year !== "number" || data.year < 2000) {
    throw new AppError(
      errors.INVALID_YEAR.message,
      errors.INVALID_YEAR.code,
      errors.INVALID_YEAR.errorCode,
      errors.INVALID_YEAR.suggestion,
    );
  }

  // 2. CNSS
  if (data.cnss) {
    validateRate(data.cnss.rate);

    if (data.cnss.ceiling < 0) {
      throw new AppError(
        errors.INVALID_CNSS_CEILING.message,
        errors.INVALID_CNSS_CEILING.code,
        errors.INVALID_CNSS_CEILING.errorCode,
        errors.INVALID_CNSS_CEILING.suggestion,
      );
    }
  }

  // 3. CSS
  if (data.css) {
    validateRate(data.css.rate);

    if (data.css.threshold < 0) {
      throw new AppError(
        errors.INVALID_CSS_THRESHOLD.message,
        errors.INVALID_CSS_THRESHOLD.code,
        errors.INVALID_CSS_THRESHOLD.errorCode,
        errors.INVALID_CSS_THRESHOLD.suggestion,
      );
    }
  }

  // 4. IRPP
  if (data.irpp) {
    // 4.1 Brackets
    if (data.irpp.brackets) {
      if (
        !Array.isArray(data.irpp.brackets) ||
        data.irpp.brackets.length === 0
      ) {
        throw new AppError(
          errors.INVALID_IRPP_BRACKETS.message,
          errors.INVALID_IRPP_BRACKETS.code,
          errors.INVALID_IRPP_BRACKETS.errorCode,
          errors.INVALID_IRPP_BRACKETS.suggestion,
        );
      }

      // Validate each bracket and ensure they are in the correct order
      let previousLimit = 0;
      data.irpp.brackets.forEach((bracket, index) => {
        if (bracket.limit !== null && (typeof bracket.limit !== "number" || bracket.limit <= 0)) {
          throw new AppError(
            errors.INVALID_BRACKET_LIMIT.message,
            errors.INVALID_BRACKET_LIMIT.code,
            errors.INVALID_BRACKET_LIMIT.errorCode,
            errors.INVALID_BRACKET_LIMIT.suggestion,
          );
        }

        validateRate(bracket.rate);

        if (bracket.limit !== null) {
          if (bracket.limit <= previousLimit) {
            throw new AppError(
              errors.INVALID_BRACKET_ORDER.message,
              errors.INVALID_BRACKET_ORDER.code,
              errors.INVALID_BRACKET_ORDER.errorCode,
              errors.INVALID_BRACKET_ORDER.suggestion,
            );
          }
          previousLimit = bracket.limit;
        }
      });
    }

    // 4.2 Frais Pro
    if (data.irpp.fraisPro) {
      validateRate(data.irpp.fraisPro.rate);
      validateDefaultAmount(data.irpp.fraisPro.ceiling, errors.INVALID_FRAIS_PRO_CEILING);
    }

    // 4.3 Family
    if (data.irpp.family) {
      const family = data.irpp.family;

      validateDefaultAmount(family.spouse, errors.INVALID_SPOUSE_AMOUNT);
      validateDefaultAmount(family.perChild, errors.INVALID_PER_CHILD_AMOUNT);
      validateDefaultAmount(family.studentChild, errors.INVALID_STUDENT_CHILD_AMOUNT);
      validateDefaultAmount(family.disabledChild, errors.INVALID_DISABLED_CHILD_AMOUNT);

      if (family.maxChildren < 0) {
        throw new AppError(
          errors.INVALID_MAX_CHILDREN.message,
          errors.INVALID_MAX_CHILDREN.code,
          errors.INVALID_MAX_CHILDREN.errorCode,
          errors.INVALID_MAX_CHILDREN.suggestion,
        );
      }
    }
  }

  // 5. Payroll
  if (data.payroll) {
    if (
      typeof data.payroll.standardMonthlyHours !== "number" ||
      data.payroll.standardMonthlyHours <= 0
    ) {
      throw new AppError(
        errors.INVALID_MONTHLY_HOURS.message,
        errors.INVALID_MONTHLY_HOURS.code,
        errors.INVALID_MONTHLY_HOURS.errorCode,
        errors.INVALID_MONTHLY_HOURS.suggestion,
      );
    }
  }
};
