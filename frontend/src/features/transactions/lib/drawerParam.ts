import { z } from 'zod';
import { u } from '@/lib/urlState';

/** `?tx=<id>` opens the row drawer over the ledger. */
export const drawerSchema = z.object({ tx: u.optionalString() });
