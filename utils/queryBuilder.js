// A helper function to help build the query for filtering, sorting, searching and pagination
export const buildQuery = (Model, queryParams, searchFields = []) => {
  // Get all documents
  let query = Model.find();

  // -------- Filtering -------- //
  /* 
    Take a copy of the query parameters (for ex: ?status=active) and 
    remove the fields that are meant for pagination, sorting and searching 
  */
  const queryObj = { ...queryParams };
  const excludedFields = ["page", "limit", "sort", "keyword"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // Advanced filtering (gte, lt, ne, etc.)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(
    /"(gt|gte|lt|lte|in|ne)":/g,
    (_, match) => `"$${match}":`,
  );

  const parsedQuery = JSON.parse(queryStr);

  // Filter
  query = query.find(parsedQuery);

  // -------- Search (Dynamic: you choose the search fields based on the model) -------- //
  if (queryParams.keyword && searchFields.length > 0) {
    const keyword = queryParams.keyword.trim();
    const words = keyword.split(" ");

    query = query.find({
      $and: words.map((word) => ({
        $or: searchFields.map((field) => ({
          [field]: { $regex: word, $options: "i" },
        })),
      })),
    });
  }

  // -------- Sorting: Support multiple sorting parameters -------- //
  if (queryParams.sort) {
    const sortBy = queryParams.sort.split(",").join(" "); // Example: "sort=createdAt,-name" => "createdAt -name"
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  return query;
};
