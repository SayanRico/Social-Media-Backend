/**
 * Social notification catalog — Mongo adaptation of reference notification engine presets.
 * moduleKey.eventKey → templates, rules, preference mapping.
 */
const SOCIAL_EVENTS = {
  like: {
    event_key: "like",
    display_name: "Post liked",
    preference_key: "likes",
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "{{actorName}} liked your post",
      body_template: "liked your post.",
      action_url_template: "/post/{{entityId}}",
    },
  },
  comment: {
    event_key: "comment",
    display_name: "New comment",
    preference_key: "comments",
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "{{actorName}} commented on your post",
      body_template: "commented on your post.",
      action_url_template: "/post/{{entityId}}",
    },
  },
  mention: {
    event_key: "mention",
    display_name: "Mention in comment",
    preference_key: "mentions",
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "{{actorName}} mentioned you",
      body_template: "mentioned you in a comment.",
      action_url_template: "/post/{{entityId}}",
    },
  },
  follow: {
    event_key: "follow",
    display_name: "New follower",
    preference_key: "follows",
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "{{actorName}} started following you",
      body_template: "started following you.",
      action_url_template: "/profile/{{actorUserId}}",
    },
  },
  new_post: {
    event_key: "new_post",
    display_name: "New post from someone you follow",
    preference_key: null,
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "{{actorName}} shared a new post",
      body_template: "Added a new post.",
      action_url_template: "/post/{{entityId}}",
    },
  },
  admin_action: {
    event_key: "admin_action",
    display_name: "Moderation action",
    preference_key: "announcements",
    rule: {
      is_active: true,
      in_app_enabled: true,
      push_enabled: true,
      exclude_actor: true,
    },
    template: {
      title_template: "Moderation notice",
      body_template: "{{actionText}}",
      action_url_template: "{{actionUrl}}",
    },
  },
};

const MODULE = {
  module_key: "social",
  display_name: "Social",
  events: SOCIAL_EVENTS,
};

const getEventConfig = (moduleKey, eventKey) => {
  if (moduleKey !== "social") return null;
  return SOCIAL_EVENTS[eventKey] || null;
};

const getCatalog = () => ({
  channels: [
    { key: "in_app", label: "In-app", live: true },
    { key: "push", label: "Push (Firebase)", live: true },
  ],
  modules: [
    {
      module_key: MODULE.module_key,
      display_name: MODULE.display_name,
      events: Object.values(SOCIAL_EVENTS).map((event) => ({
        module_key: MODULE.module_key,
        event_key: event.event_key,
        display_name: event.display_name,
        preference_key: event.preference_key,
        rule: event.rule,
        template: event.template,
      })),
    },
  ],
  stats: {
    module_count: 1,
    event_count: Object.keys(SOCIAL_EVENTS).length,
    active_event_count: Object.values(SOCIAL_EVENTS).filter(
      (e) => e.rule.is_active
    ).length,
  },
});

module.exports = {
  SOCIAL_EVENTS,
  getEventConfig,
  getCatalog,
};
