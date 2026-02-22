import { ScheduleFormModal } from './ScheduleFormModal';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Thin wrapper for backwards compatibility — delegates to ScheduleFormModal in create mode */
export const CreateScheduleModal = ({ isOpen, onClose }: CreateScheduleModalProps) => {
  return <ScheduleFormModal isOpen={isOpen} onClose={onClose} />;
};
