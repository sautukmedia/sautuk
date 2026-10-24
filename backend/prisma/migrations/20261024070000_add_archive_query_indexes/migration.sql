-- Concurrent builds keep the existing site writable while indexes are created.
CREATE INDEX CONCURRENTLY "Post_status_createdAt_id_idx" ON "Post"("status", "createdAt", "id");
CREATE INDEX CONCURRENTLY "Post_categoryId_status_createdAt_id_idx" ON "Post"("categoryId", "status", "createdAt", "id");
CREATE INDEX CONCURRENTLY "Post_featured_status_createdAt_id_idx" ON "Post"("featured", "status", "createdAt", "id");
CREATE INDEX CONCURRENTLY "PostTag_tagId_postId_idx" ON "PostTag"("tagId", "postId");
CREATE INDEX CONCURRENTLY "Analytics_postId_idx" ON "Analytics"("postId");
