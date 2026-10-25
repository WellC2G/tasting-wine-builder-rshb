import type { Request } from 'express';

import type { Participant } from '../../auth/entities/participant.entity';
import type { SessionViewer } from '../../tasting-session/interfaces/tasting-session.interfaces';

export interface RatingsGuestRequest extends Request {
  ratingParticipant?: Participant;
}

export interface RoundStatsRequest extends Request {
  sessionViewer?: SessionViewer;
}
