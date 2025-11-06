import multer from "multer";
import { v4 as uuid } from "uuid";

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "./public/temp");
  },
  filename(req, file, cb) {
    const ext = file.originalname.split(".").pop();
    cb(null, `${uuid()}.${ext}`);
  }
});

export const upload = multer({ storage });
