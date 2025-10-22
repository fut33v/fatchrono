import { IsBoolean } from 'class-validator';

export class UpdateParticipantIssueDto {
  @IsBoolean()
  isIssued!: boolean;
}
