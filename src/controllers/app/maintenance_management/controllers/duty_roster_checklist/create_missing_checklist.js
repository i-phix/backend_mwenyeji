const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const createMissingChecklist = async (request, reply) => {
    try {
        const { facilityId, dutyRosterId } = request.params;
        const { taskFrequency = "daily", customDates = null } = request.body;

        // Audit the checklist creation attempt
        await audit_trail(request, {
            activity: "Create Missing Checklist",
            custom_data: {
                facility_id: facilityId,
                duty_roster_id: dutyRosterId,
                task_frequency: taskFrequency,
                has_custom_dates: !!customDates,
                custom_dates_count: customDates ? customDates.length : 0,
            },
        });

        console.log(`Creating missing checklist for duty roster: ${dutyRosterId}`);

        // Validate ObjectId format
        if (!dutyRosterId.match(/^[0-9a-fA-F]{24}$/)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    error_type: "ValidationError",
                    error_message: "Invalid duty roster ID format",
                    invalid_duty_roster_id: dutyRosterId,
                },
            });

            return reply.code(400).send({
                success: false,
                error: "Invalid duty roster ID format",
            });
        }

        // Validate task frequency
        const validFrequencies = ["daily", "weekly", "monthly", "custom"];
        if (!validFrequencies.includes(taskFrequency)) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    error_type: "ValidationError",
                    error_message: `Invalid task frequency. Must be one of: ${validFrequencies.join(", ")}`,
                    invalid_task_frequency: taskFrequency,
                    valid_frequencies: validFrequencies,
                },
            });

            return reply.code(400).send({
                success: false,
                error: `Invalid task frequency. Must be one of: ${validFrequencies.join(", ")}`,
            });
        }

        // Get required models
        const dutyRosterModel = await getModel(
            "DutyRoster",
            payservedb.DutyRoster.schema,
            facilityId,
        );

        const dutyRosterChecklistModel = await getModel(
            "DutyRosterChecklist",
            payservedb.DutyRosterChecklist.schema,
            facilityId,
        );

        const childWorkplanModel = await getModel(
            "ChildWorkplan",
            payservedb.MasterWorkplanChild.schema,
            facilityId,
        );

        // Get the duty roster
        const dutyRoster = await dutyRosterModel.findById(dutyRosterId);
        if (!dutyRoster) {
            // Audit duty roster not found
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    error: "Duty roster not found",
                },
            });

            return reply.code(404).send({
                success: false,
                error: "Duty roster not found",
            });
        }

        // Verify duty roster belongs to the facility
        if (dutyRoster.facilityId && dutyRoster.facilityId.toString() !== facilityId) {
            // Audit unauthorized access
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    error_type: "UnauthorizedAccess",
                    duty_roster_facility_id: dutyRoster.facilityId.toString(),
                    requested_facility_id: facilityId,
                },
            });

            return reply.code(403).send({
                success: false,
                error: "Unauthorized: Duty roster does not belong to this facility",
            });
        }

        // Check if checklist already exists
        const existingChecklist = await dutyRosterChecklistModel.findOne({
            dutyRosterId: dutyRosterId,
        });

        if (existingChecklist) {
            // Audit duplicate checklist attempt
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    error_type: "DuplicateChecklist",
                    error: "Checklist already exists for this duty roster",
                    existing_checklist_id: existingChecklist._id,
                },
            });

            return reply.code(409).send({
                success: false,
                error: "Checklist already exists for this duty roster",
                checklistId: existingChecklist._id,
            });
        }

        // Get child workplans for the master workplan
        const childWorkplans = await childWorkplanModel.find({
            parent: dutyRoster.masterWorkplanId,
        });

        if (childWorkplans.length === 0) {
            // Audit no child workplans found
            await audit_trail(request, {
                activity: "Create Missing Checklist",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    duty_roster_id: dutyRosterId,
                    master_workplan_id: dutyRoster.masterWorkplanId,
                    error_type: "NoChildWorkplans",
                    error: "No child workplans found for the master workplan",
                },
            });

            return reply.code(400).send({
                success: false,
                error: "No child workplans found for the master workplan",
            });
        }

        console.log(`Found ${childWorkplans.length} child workplans`);

        // Generate dates
        let scheduleDates = [];
        let dateGenerationMethod = "custom";

        if (customDates && Array.isArray(customDates)) {
            scheduleDates = customDates.map((date) => new Date(date));
            dateGenerationMethod = "custom_provided";
        } else {
            // Use the static method or fallback function
            try {
                scheduleDates = dutyRosterChecklistModel.generateDateRange(
                    dutyRoster.startDate,
                    dutyRoster.endDate,
                    taskFrequency,
                );
                dateGenerationMethod = "static_method";
            } catch (error) {
                console.log("Using fallback date generation");
                scheduleDates = generateDateRange(
                    dutyRoster.startDate,
                    dutyRoster.endDate,
                    taskFrequency,
                );
                dateGenerationMethod = "fallback_function";

                // Audit fallback usage
                await audit_trail(request, {
                    activity: "Create Missing Checklist",
                    response_status: "warning",
                    custom_data: {
                        facility_id: facilityId,
                        duty_roster_id: dutyRosterId,
                        warning: "Static date generation method failed, using fallback",
                        error_message: error.message,
                    },
                });
            }
        }

        console.log(`Generated ${scheduleDates.length} scheduled dates`);

        // Create tasks array
        const tasks = childWorkplans.map((childWorkplan) => ({
            childWorkplanId: childWorkplan._id,
            scheduledDates: scheduleDates.map((date) => ({
                date: new Date(date),
                status: "pending",
                startTime: "",
                endTime: "",
            })),
            priority: "medium",
            isRecurring: taskFrequency !== "custom",
            recurringPattern: taskFrequency,
        }));

        // Create the checklist
        const checklist = await dutyRosterChecklistModel.create({
            dutyRosterId: dutyRoster._id,
            facilityId: facilityId,
            staffId: dutyRoster.staffId,
            masterWorkplanId: dutyRoster.masterWorkplanId,
            tasks,
            period: {
                startDate: dutyRoster.startDate,
                endDate: dutyRoster.endDate,
            },
            status: "active",
        });

        console.log("Checklist created successfully:", checklist._id);

        // Audit successful checklist creation
        await audit_trail(request, {
            activity: "Create Missing Checklist - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                duty_roster_id: dutyRosterId,
                checklist_id: checklist._id,
                staff_id: dutyRoster.staffId,
                master_workplan_id: dutyRoster.masterWorkplanId,
                tasks_count: tasks.length,
                scheduled_dates_count: scheduleDates.length,
                task_frequency: taskFrequency,
                date_generation_method: dateGenerationMethod,
                period: {
                    start_date: dutyRoster.startDate,
                    end_date: dutyRoster.endDate,
                },
                summary: checklist.summary,
                total_scheduled_items: tasks.length * scheduleDates.length,
            },
        });

        return reply.code(201).send({
            success: true,
            message: "Checklist created successfully for existing duty roster",
            data: {
                checklistId: checklist._id,
                dutyRosterId: dutyRoster._id,
                tasksCount: tasks.length,
                scheduledDatesCount: scheduleDates.length,
                summary: checklist.summary,
            },
        });
    } catch (error) {
        console.error("Error creating missing checklist:", error);

        // Audit the error
        await audit_trail(request, {
            activity: "Create Missing Checklist - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                duty_roster_id: request.params.dutyRosterId,
                error_type: error.name,
                error_message: error.message,
                error_stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                request_body: request.body,
            },
        });

        return reply.code(500).send({
            success: false,
            error: error.message,
        });
    }
};

// Fallback date generation function
const generateDateRange = (startDate, endDate, frequency) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);

    switch (frequency) {
        case "daily":
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            break;

        case "weekly":
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 7);
            }
            break;

        case "monthly":
            while (current <= end) {
                dates.push(new Date(current));
                current.setMonth(current.getMonth() + 1);
            }
            break;

        default:
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            break;
    }

    return dates;
};

module.exports = createMissingChecklist;