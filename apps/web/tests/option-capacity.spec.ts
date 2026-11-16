import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { prisma } from "@rallly/database";
import { NewPollPage } from "./new-poll-page";

// Places per option: an organizer caps how many participants can answer yes
// to each option. Only yes takes a place. The client disables yes on a full
// option, and the server refuses it under the poll row lock, so a page that
// went stale while someone else took the last place is refused too.

const yesOn = (page: Page, index: number) =>
  page.getByTestId("vote-selector").nth(index).getByRole("radio", {
    name: "Yes",
  });

/** Answers yes to the first option through the vote page, as a new guest. */
async function respondYesToFirst(
  browser: Browser,
  voteUrl: string,
  name: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(voteUrl);
  await yesOn(page, 0).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Jessie Smith").fill(name);
  await page.getByRole("button", { name: "Save availability" }).click();
  await expect(page.getByText("Your response has been saved")).toBeVisible();
  await page.getByRole("button", { name: "Back to poll" }).click();
  return { context, page };
}

test.describe
  .serial("places per option", () => {
    let pollId: string;
    let inviteUrl: string;
    let voteUrl: string;
    let optionIds: string[];
    let alice: { context: BrowserContext; page: Page };

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      const newPollPage = new NewPollPage(page);
      await newPollPage.goto();
      const pollPage = await newPollPage.create({
        name: "Capped Workshop",
        optionCapacity: 2,
      });
      pollId = page.url().match(/\/poll\/([^/?]+)/)?.[1] as string;
      inviteUrl = (await pollPage.copyInviteLink()).replace(/\?.*$/, "");
      voteUrl = `${inviteUrl}/vote`;
      await page.close();

      const options = await prisma.option.findMany({
        where: { pollId },
        orderBy: { startTime: "asc" },
        select: { id: true },
      });
      optionIds = options.map((option) => option.id);
    });

    test.afterAll(async () => {
      await alice?.context.close();
    });

    test("the setting is saved with the poll", async () => {
      const poll = await prisma.poll.findUniqueOrThrow({
        where: { id: pollId },
        select: { optionCapacity: true },
      });
      expect(poll.optionCapacity).toBe(2);
    });

    test("yes is disabled on an option once its places are taken", async ({
      browser,
      page,
    }) => {
      alice = await respondYesToFirst(browser, voteUrl, "Alice");
      const bob = await respondYesToFirst(browser, voteUrl, "Bob");
      await bob.context.close();

      await page.goto(voteUrl);
      const badges = page.getByTestId("option-capacity");
      await expect(badges.nth(0)).toHaveText("Full (2/2)");
      await expect(badges.nth(1)).toHaveText("0/2 places");

      await expect(yesOn(page, 0)).toBeDisabled();
      await expect(yesOn(page, 1)).toBeEnabled();
      // Only yes takes a place: the full option still takes the others
      const first = page.getByTestId("vote-selector").nth(0);
      await expect(
        first.getByRole("radio", { name: "If need be" }),
      ).toBeEnabled();
      await expect(first.getByRole("radio", { name: "No" })).toBeEnabled();
    });

    test("the server refuses a yes for a place taken behind a stale page", async ({
      page,
    }) => {
      await page.goto(voteUrl);
      await expect(yesOn(page, 1)).toBeEnabled();

      // Two responses fill the second option after the page was loaded.
      for (const name of ["Chloé", "David"]) {
        await prisma.participant.create({
          data: {
            pollId,
            name,
            token: `capacity-test-${name}-${Date.now()}`,
            votes: {
              create: { pollId, optionId: optionIds[1], type: "yes" },
            },
          },
        });
      }

      await yesOn(page, 1).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByPlaceholder("Jessie Smith").fill("Late Larry");
      await page.getByRole("button", { name: "Save availability" }).click();

      await expect(
        page.getByText(
          "One of the options you answered yes to has just filled up. Pick another one.",
        ),
      ).toBeVisible();
      expect(
        await prisma.participant.count({
          where: { pollId, name: "Late Larry" },
        }),
      ).toBe(0);
    });

    test("a yes already held is kept when the cap is lowered", async () => {
      await prisma.poll.update({
        where: { id: pollId },
        data: { optionCapacity: 1 },
      });

      const page = alice.page;
      await page.goto(voteUrl);
      const bar = page.locator("#main-content footer");
      await bar.getByRole("button", { name: "Edit" }).click();

      // Alice holds a place on the first option, so yes stays hers
      await expect(yesOn(page, 0)).toBeEnabled();
      await expect(yesOn(page, 0)).toBeChecked();
      // ...but the second option, now over the lowered cap, is closed to her
      await expect(yesOn(page, 1)).toBeDisabled();

      await bar.getByRole("button", { name: "Save" }).click();
      await expect(bar.getByRole("button", { name: "Edit" })).toBeVisible();

      const aliceYes = await prisma.vote.count({
        where: {
          pollId,
          optionId: optionIds[0],
          type: "yes",
          participant: { name: "Alice" },
        },
      });
      expect(aliceYes).toBe(1);

      await prisma.poll.update({
        where: { id: pollId },
        data: { optionCapacity: 2 },
      });
    });

    test("the poll grid skips yes on a full option", async ({ page }) => {
      await page.goto(inviteUrl);
      await expect(page.getByTestId("option-capacity").first()).toHaveText(
        "Full (2/2)",
      );

      const firstCell = page.getByTestId("vote-selector").first();
      await firstCell.click();
      // The cycle starts at yes on an option with room; here it skips it
      await expect(firstCell).toHaveAttribute("aria-label", /If need be$/);
      await firstCell.click();
      await expect(firstCell).toHaveAttribute("aria-label", /No$/);
      await firstCell.click();
      await expect(firstCell).toHaveAttribute("aria-label", /If need be$/);
    });
  });

test("the calendar view skips yes on a full day", async ({ browser, page }) => {
  const newPollPage = new NewPollPage(page);
  await newPollPage.goto();
  const pollPage = await newPollPage.create({
    name: "Capped Open Day",
    allDay: true,
    optionCapacity: 1,
  });
  const voteUrl = `${(await pollPage.copyInviteLink()).replace(/\?.*$/, "")}/vote`;
  const alice = await respondYesToFirst(browser, voteUrl, "Alice");
  await alice.context.close();

  await page.goto(voteUrl);
  await page.getByRole("radio", { name: "Calendar" }).click();
  const badges = page.getByTestId("option-capacity");
  await expect(badges.first()).toContainText("1/1");

  // A day cycles through the votes on click; the full one never lands on yes
  const day = (index: number) =>
    badges.nth(index).locator("xpath=ancestor::button[1]");
  await day(0).click();
  // VoteIcon names the vote in an SVG <title>
  await expect(day(0).locator("svg title")).toHaveText("If need be");
  await day(1).click();
  await expect(day(1).locator("svg title")).toHaveText("Yes");
});
