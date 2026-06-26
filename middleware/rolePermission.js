import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const authorizeRole = (role) => {
    return (req, res, next) => {
        const token = req.headers["authorization"]?.split(" ")[1];
        if(!token){
            return res.status(401).json({
                status: "Error",
                message: "No Token provided!"
            });
        }

        try{
            // Verify the token validity
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if(decoded.role != role){
                return res.status(403).json({
                    status: "Error",
                    message: "Insufficient permissions"
                });
            }

            req.user = decoded;
            next();
        }
        catch(err){
            return res.status(500).json({
                status: "Error",
                message: err.message
            });
        }
    };
};

export default authorizeRole;