import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Props = HTMLMotionProps<"div"> & { children: ReactNode; amplitude?: number; duration?: number };

export function Float({ children, amplitude = 15, duration = 6, ...rest }: Props) {
  return (
    <motion.div
      animate={{ y: [0, -amplitude, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
