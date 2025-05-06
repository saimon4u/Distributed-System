import mongoose from "mongoose";

const DATABASE_URI = process.env.DATABASE_URI || "mongodb://localhost:27017/phase1";


const connectDb = async () => {
  try{
    await mongoose.connect(DATABASE_URI);
    console.log("Database connected....");
  }catch(e){
    console.log(e)
  }
}

export default connectDb;