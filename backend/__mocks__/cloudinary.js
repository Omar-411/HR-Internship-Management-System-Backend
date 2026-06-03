// Cloudinary mock (Simulation) for jest (UPLOAD_IMAGE audit log test)
export const v2 = {
  config: jest.fn(),
  uploader: {
    upload: jest.fn().mockResolvedValue({
      secure_url: "http://mocked.url/profile.png",
    }),
    upload_stream: jest.fn().mockImplementation((options, callback) => {
      callback(null, { secure_url: "http://mocked.url/profile.png" });
      return {
        end: jest.fn(),
      };
    }),
  },
};
