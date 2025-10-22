CREATE TABLE IF NOT EXISTS "ParticipantIssue" (
  "participantId" TEXT PRIMARY KEY,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipantIssue_participantId_fkey" FOREIGN KEY ("participantId")
    REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
