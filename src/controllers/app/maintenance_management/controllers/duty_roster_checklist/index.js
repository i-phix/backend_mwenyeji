const getDutyRosterChecklist = require("./get_checklist");
const getDutyRosterChecklists = require("./get_all_checklists");
const getChecklistByDutyRoster = require("./get_checklist_by_roster");
const updateTaskStatus = require("./update_task_status");
const addTaskToChecklist = require("./add_task_to_checklist");
const removeTaskFromChecklist = require("./remove_task_from_checklist");
const getTodaysTasks = require("./get_todays_tasks");
const getChecklistAnalytics = require("./checklist_analytics");
const createMissingChecklist = require("./create_missing_checklist");

module.exports = {
  getDutyRosterChecklist,
  getDutyRosterChecklists,
  getChecklistByDutyRoster,
  updateTaskStatus,
  addTaskToChecklist,
  removeTaskFromChecklist,
  getTodaysTasks,
  getChecklistAnalytics,
  createMissingChecklist,
};
