import AppError from "../utils/AppError.js";
import { errors } from "../errors/commonErrors.js";
import { buildQuery } from "../utils/queryBuilder.js";
import { resolveId } from "../utils/idResolver.js";

// Get a single document by Id
export const getOne = (Model, errorMessage = errors.RESOURCE_NOT_FOUND, populateOptions = null, selectFields = null) => async (id) => {
  let query = Model.findOne(resolveId(id));

  if (populateOptions) {
    query = query.populate(populateOptions);
  }

  if (selectFields) {
    query = query.select(selectFields);
  }

  const doc = await query;
  if (!doc) {
    throw new AppError(
      errorMessage.message,
      errorMessage.code,
      errorMessage.errorCode,
      errorMessage.suggestion
    );
  }

  return {
    status: "Success",
    code: 200,
    message: `${Model.modelName} retrieved successfully!`,
    data: doc
  };
};

// Get all documents with optional filtering, sorting, searching and pagination
export const getAll = (Model, populateOptions = null, selectFields = null, searchFields = []) => async (queryParams) => {
  let query = buildQuery(Model, queryParams, searchFields);

  // Extract the filter conditions from the query builder before the pagination
  const filter = query.getQuery();

  if (selectFields) {
    query = query.select(selectFields);
  }

  if (populateOptions) {
    query = query.populate(populateOptions);
  }

  // Pagination
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total count of documents matching the filter (Dynamic count based on the filter conditions)
  const totalCount = await Model.countDocuments(filter);

  query = query.skip(skip).limit(limit);

  const docs = await query;

  return {
    status: "Success",
    code: 200,
    message: `List of ${Model.modelName.toLowerCase()}s retrieved successfully!`,
    data: docs,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limitPerPage: limit,
      totalCount,
    }
  };
};

// Creation of a new document
export const createOne = (Model) => async (data) => {
  const doc = await Model.create(data);

  return {
    status: "Success",
    code: 201,
    message: `${Model.modelName} created successfully!`,
    data: doc
  };
};

// Update a document
export const updateOne = (Model, errorMessage = errors.RESOURCE_NOT_FOUND) => async (id, data) => {
  const doc = await Model.findOneAndUpdate(resolveId(id), data, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!doc) {
    throw new AppError(
      errorMessage.message,
      errorMessage.code,
      errorMessage.errorCode,
      errorMessage.suggestion
    );
  }

  return {
    status: "Success",
    code: 200,
    message: `${Model.modelName} updated successfully!`,
    data: doc
  };
};

// Delete a document
export const deleteOne = (Model, errorMessage = errors.RESOURCE_NOT_FOUND) => async (id) => {
  const doc = await Model.findOneAndDelete(resolveId(id));

  if (!doc) {
    throw new AppError(
      errorMessage.message,
      errorMessage.code,
      errorMessage.errorCode,
      errorMessage.suggestion
    );
  }

  return {
    status: "Success",
    code: 200,
    message: `${Model.modelName} deleted successfully!`,
    data: doc
  };
};
