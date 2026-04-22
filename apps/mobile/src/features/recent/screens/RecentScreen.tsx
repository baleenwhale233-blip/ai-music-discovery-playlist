import { StyleSheet, Text, View } from "react-native";

export function RecentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>最近页骨架</Text>
      <Text style={styles.body}>后续接入最近播放与最近导入。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "700"
  },
  body: {
    textAlign: "center",
    color: "#475569"
  }
});
