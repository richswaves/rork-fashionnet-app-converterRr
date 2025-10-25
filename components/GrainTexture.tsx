import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export default function GrainTexture() {
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const opacity2 = useRef(new Animated.Value(0.6)).current;
  
  useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.8,
            duration: 100 + delay,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 120 + delay,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.6,
            duration: 80 + delay,
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createAnimation(opacity1, 0);
    const anim2 = createAnimation(opacity2, 50);

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [opacity1, opacity2]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.grain1,
          { opacity: opacity1 },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.grain2,
          { opacity: opacity2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grain1: {
    backgroundColor: 'transparent',
    backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 0, 0, 0.15) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 50%), radial-gradient(circle at 90% 10%, rgba(0, 0, 0, 0.1) 0%, transparent 50%)',
  } as any,
  grain2: {
    backgroundColor: 'transparent',
    backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(0, 0, 0, 0.12) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(0, 0, 0, 0.08) 0%, transparent 50%)',
  } as any,
});
