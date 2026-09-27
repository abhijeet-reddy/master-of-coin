import { z } from 'zod';
import { u } from '@/lib/urlState';

/** `?archived=1` keeps the Archived group open (and makes it linkable). */
export const listSchema = z.object({ archived: u.boolean(false) });
