import { defineSchedule } from "@cursor/bdk/schedules";

export default defineSchedule({
  cron: "0 9 * * 1",
  async run({ callTool }) {
    await callTool("weekly_leadership_summary", { source: "schedule" });
  },
});
