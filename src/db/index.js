import { DB_NAME } from "../constants.js";
import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        
        console.log(`MongoDB Connected To The Database: ${DB_NAME} Successfully`);
        console.log(`DataBase Name : ${connectionInstance.connection.name}`);
        
    } catch (error) {
        console.log("Error Connecting To The MongoDB :", error);
        process.exit(1);
    }
}
export { connectDB };