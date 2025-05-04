import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import userRouter from "./src/routes/userRoutes.js";
import connectDb from "./src/config/dbConfig.js";
import bookRouter from "./src/routes/bookRoutes.js";
import loanRouter from "./src/routes/loanRoutes.js";
import statsRouter from "./src/routes/statsRoutes.js";

dotenv.config();
const __dirname = path.resolve() + "/static";
const app = express();
const PORT = process.env.PORT || 3000;

await connectDb();

app.use(express.json());

const corsOptions = {
	origin: '*',
	credentials: true,
};

app.use(cors(corsOptions));

app.use("/api/users", userRouter);
app.use("/api/books", bookRouter);
app.use("/api/loans", loanRouter);
app.use("/api/stats", statsRouter);


app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "welcome.html"));
});

app.listen(PORT, () => {
	console.log(`Backend server is running on port ${PORT}`);
});