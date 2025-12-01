import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query all appointments
 * For pet owners: filters by user email
 * For staff/vet/admin: returns all appointments
 */
export const list = query({
  args: {
    userEmail: v.optional(v.string()), // Optional: if provided, filter by email (for pet owners)
    userRole: v.optional(v.string()), // Optional: user role to determine if filtering is needed
  },
  returns: v.array(
    v.object({
      _id: v.id("appointments"),
      _creationTime: v.number(),
      petName: v.string(),
      ownerName: v.string(),
      phone: v.string(),
      email: v.string(),
      date: v.string(),
      time: v.string(),
      reason: v.optional(v.string()),
      vet: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled"),
        v.literal("rescheduled")
      ),
      notes: v.optional(v.string()),
      serviceType: v.optional(v.string()),
      price: v.optional(v.number()),
      paymentStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("down_payment_paid"),
          v.literal("fully_paid")
        )
      ),
      paymentData: v.optional(v.any()),
      itemsUsed: v.optional(v.array(v.object({
        itemId: v.string(),
        quantity: v.number(),
        itemName: v.string(),
        itemCategory: v.string(),
        deductionStatus: v.optional(v.union(
          v.literal("pending"),
          v.literal("confirmed"),
          v.literal("rejected")
        )),
        loggedAt: v.optional(v.string()),
        rejectedReason: v.optional(v.string()),
        approvedBy: v.optional(v.string()),
        approvedByName: v.optional(v.string()),
        approvedAt: v.optional(v.string()),
      }))),
    })
  ),
  handler: async (ctx, args) => {
    // If user is a pet owner and email is provided, filter by email
    if (args.userRole === 'owner' && args.userEmail) {
      return await ctx.db
        .query("appointments")
        .withIndex("by_email", (q) => q.eq("email", args.userEmail!))
        .collect();
    }
    
    // For staff, vet, admin, or when no role is specified - return all appointments
    return await ctx.db.query("appointments").collect();
  },
});

/**
 * Query appointments by date
 */
export const listByDate = query({
  args: {
    date: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("appointments"),
      _creationTime: v.number(),
      petName: v.string(),
      ownerName: v.string(),
      phone: v.string(),
      email: v.string(),
      date: v.string(),
      time: v.string(),
      reason: v.optional(v.string()),
      vet: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled"),
        v.literal("rescheduled")
      ),
      notes: v.optional(v.string()),
      serviceType: v.optional(v.string()),
      price: v.optional(v.number()),
      paymentStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("down_payment_paid"),
          v.literal("fully_paid")
        )
      ),
      paymentData: v.optional(v.any()),
      itemsUsed: v.optional(v.array(v.object({
        itemId: v.string(),
        quantity: v.number(),
        itemName: v.string(),
        itemCategory: v.string(),
        deductionStatus: v.optional(v.union(
          v.literal("pending"),
          v.literal("confirmed"),
          v.literal("rejected")
        )),
        loggedAt: v.optional(v.string()),
        rejectedReason: v.optional(v.string()),
        approvedBy: v.optional(v.string()),
        approvedByName: v.optional(v.string()),
        approvedAt: v.optional(v.string()),
      }))),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

/**
 * Add a new appointment
 */
export const add = mutation({
  args: {
    petName: v.string(),
    ownerName: v.string(),
    phone: v.string(),
    email: v.string(),
    date: v.string(),
    time: v.string(),
    reason: v.optional(v.string()),
    vet: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("rescheduled")
    ),
    notes: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    price: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("down_payment_paid"),
        v.literal("fully_paid")
      )
    ),
    paymentData: v.optional(v.any()),
  },
  returns: v.id("appointments"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("appointments", args);
  },
});

/**
 * Update an appointment
 */
export const update = mutation({
  args: {
    id: v.id("appointments"),
    petName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    reason: v.optional(v.string()),
    vet: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled"),
        v.literal("rescheduled")
      )
    ),
    notes: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    price: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("down_payment_paid"),
        v.literal("fully_paid")
      )
    ),
    paymentData: v.optional(v.any()),
    itemsUsed: v.optional(v.array(v.object({
      itemId: v.string(),
      quantity: v.number(),
      itemName: v.string(),
      itemCategory: v.string(),
      deductionStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("rejected")
      )),
      loggedAt: v.optional(v.string()),
      rejectedReason: v.optional(v.string()),
      approvedBy: v.optional(v.string()),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.string()),
    }))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const appointment = await ctx.db.get(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    await ctx.db.patch(id, updates);
    return null;
  },
});

/**
 * Delete an appointment
 */
export const remove = mutation({
  args: {
    id: v.id("appointments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

