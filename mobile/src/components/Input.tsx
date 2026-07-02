import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, font, radius, spacing } from "../theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, style, ...rest }, ref) {
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.muted}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: font.base,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: font.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
