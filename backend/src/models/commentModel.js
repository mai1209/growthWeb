import mongoose from "mongoose";

// Comentario en un posteo de comunidad.
const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    texto: { type: String, default: "", trim: true, maxlength: 600 },
  },
  { timestamps: true }
);

const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);
export default Comment;
