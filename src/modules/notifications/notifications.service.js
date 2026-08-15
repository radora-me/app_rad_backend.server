const prisma = require("../../core/database/prisma");

class NotificationsService {
  async registerDeviceToken(userId, { pushToken, platform }) {
    const normalizedToken = String(pushToken).trim();
    if (!normalizedToken) {
      throw new Error("Push token is required");
    }

    const tokenRecord = await prisma.deviceToken.upsert({
      where: {
        userId_token: {
          userId,
          token: normalizedToken,
        },
      },
      update: {
        platform: platform || "unknown",
        isActive: true,
      },
      create: {
        userId,
        token: normalizedToken,
        platform: platform || "unknown",
        isActive: true,
      },
    });

    return tokenRecord;
  }

  async sendToUser(userId, title, body, data = {}) {
    const tokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    if (!tokens.length) {
      return { sent: 0, tokens: 0 };
    }

    const payload = {
      to: tokens.map((tokenRecord) => tokenRecord.token),
      sound: "default",
      title,
      body,
      data,
      ttl: 60,
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    return {
      sent: tokens.length,
      status: response.status,
      result,
    };
  }
}

module.exports = new NotificationsService();
