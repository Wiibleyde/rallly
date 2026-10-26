import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@rallly/database";
import { NewPollPage } from "./new-poll-page";

test.describe("poll expiry date", () => {
  test("can be set on creation, then changed and cleared when editing", async ({
    page,
  }) => {
    const newPollPage = new NewPollPage(page);
    await newPollPage.goto();
    // Month, day, year: the test locale is en-US.
    const pollPage = await newPollPage.create({
      name: "Expiring poll",
      expiryDate: "12312099",
    });
    await pollPage.closeShareDialog();

    const pollId = page.url().match(/\/poll\/([a-zA-Z0-9]+)/)?.[1] ?? "";
    expect(pollId).not.toBe("");

    const created = await prisma.poll.findUnique({ where: { id: pollId } });
    expect(created?.expiresAt?.toISOString()).toBe("2099-12-31T00:00:00.000Z");

    // The organizer sees it on the poll page, a participant on the vote page.
    await expect(page.getByText(/Expires on .*2099/)).toBeVisible();
    await page.goto(`/invite/${pollId}`);
    await expect(page.getByText(/Expires on .*2099/)).toBeVisible();

    await page.goto(`/poll/${pollId}`);
    await pollPage.editOptions();

    const expiry = page.getByRole("group", { name: "Expiry date" });
    await expect(expiry.getByRole("spinbutton", { name: /year/i })).toHaveText(
      "2099",
    );

    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(`**/poll/${pollId}`);

    const cleared = await prisma.poll.findUnique({ where: { id: pollId } });
    expect(cleared?.expiresAt).toBeNull();

    await expect(
      page.getByRole("heading", { name: "Expiring poll" }),
    ).toBeVisible();
    await expect(page.getByText(/Expires on/)).toHaveCount(0);
  });

  test.describe("shown to participants", () => {
    const pollIds: string[] = [];

    const seedPoll = async (expiresAt: Date | null) => {
      const poll = await prisma.poll.create({
        data: {
          id: `expiry-${randomUUID().slice(0, 8)}`,
          title: "Seeded poll",
          expiresAt,
          options: { create: { startTime: new Date("2099-06-01T00:00:00Z") } },
        },
      });
      pollIds.push(poll.id);
      return poll.id;
    };

    test.afterAll(async () => {
      await prisma.poll.deleteMany({ where: { id: { in: pollIds } } });
    });

    test("on the invite and vote pages", async ({ page }) => {
      const pollId = await seedPoll(new Date("2099-12-31T00:00:00Z"));

      for (const path of [`/invite/${pollId}`, `/invite/${pollId}/vote`]) {
        await page.goto(path);
        await expect(page.getByText(/Expires on .*2099/)).toBeVisible();
      }
    });

    test("not when the poll has no expiry date", async ({ page }) => {
      const pollId = await seedPoll(null);

      for (const path of [`/invite/${pollId}`, `/invite/${pollId}/vote`]) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { name: "Seeded poll" }),
        ).toBeVisible();
        await expect(page.getByText(/Expires on/)).toHaveCount(0);
      }
    });
  });

  test("a poll created without an expiry date has none", async ({ page }) => {
    const newPollPage = new NewPollPage(page);
    await newPollPage.goto();
    const pollPage = await newPollPage.create({ name: "No expiry poll" });
    await pollPage.closeShareDialog();

    const pollId = page.url().match(/\/poll\/([a-zA-Z0-9]+)/)?.[1] ?? "";
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    expect(poll?.expiresAt).toBeNull();
    await expect(page.getByText(/Expires on/)).toHaveCount(0);
  });
});
