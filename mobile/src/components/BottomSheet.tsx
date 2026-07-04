import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // When false, the backdrop tap and Android hardware-back no longer dismiss
  // the sheet — used for flows that must be exited via an explicit in-sheet
  // action instead of an implicit "back" gesture.
  dismissable?: boolean;
}

export default function BottomSheet({ visible, onClose, children, dismissable = true }: BottomSheetProps) {
  const handleClose = dismissable ? onClose : () => {};
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={styles.sheet}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 8,
  },
});
