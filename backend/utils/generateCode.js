// Password + OTP Code generation
export const generateRandomCode = (length = 8) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;

  let randomCode = "";

  // Ensure at least one of each required type for security
  randomCode += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  randomCode += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  randomCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
  randomCode += symbols.charAt(Math.floor(Math.random() * symbols.length));

  // Fill the rest randomly
  for (let i = randomCode.length; i < length; i++) {
    randomCode += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the random part so the required chars aren't always at the start
  const shuffledCode = randomCode
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");

  return shuffledCode;
};
