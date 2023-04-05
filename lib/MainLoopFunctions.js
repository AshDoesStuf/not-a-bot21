const { RGBot } = require("rg-bot");
const { Entity } = require("prismarine-entity");
const { Block } = require("prismarine-block");
const { Vec3 } = require("vec3");
const { RGCTFUtils } = require("rg-ctf-utils");
const {
  POTION_TYPE,
  moveTowardPosition,
  usePotionOfType,
  getPotionOfType,
  usePotion,
} = require("./HelperFunctions");

/**
 * @param {RGBot} bot
 * @param {RGCTFUtils} rgCtfUtils
 * @param {Entity[]} opponents
 * @param {Entity[]} teamMates
 * @return {Promise<boolean>}
 */
async function handleLowHealth(bot, rgCtfUtils, opponents, teamMates) {
  if (bot.mineflayer().health <= 7) {
    const nearOpponent = opponents.find((them) => {
      return them.position.distanceSquared(bot.position()) <= 16;
    });
    if (nearOpponent) {
    }
  } else if (bot.mineflayer().health <= 15) {
  }
  return false;
}

/**
 * @param {RGBot} bot
 * @param {RGCTFUtils} rgCtfUtils
 * @param {Entity[]} opponents
 * @param {Entity[]} teamMates
 * @return {Promise<boolean>}
 */
async function handleAttackFlagCarrier(bot, rgCtfUtils, opponents, teamMates) {
  const flagLocation = rgCtfUtils.getFlagLocation();
  if (!flagLocation) {
    console.log(
      `Checking ${opponents.length} opponents in range for flag carriers`
    );

    const opponentWithFlag = opponents
      .filter((them) => {
        if (
          them.heldItem &&
          them.heldItem.name.includes(rgCtfUtils.FLAG_SUFFIX)
        ) {
          console.log(`Player ${them.name} is holding the flag`);
          return true;
        }
      })
      ?.shift();
    if (opponentWithFlag) {
      console.log(
        `Attacking flag carrier ${
          opponentWithFlag.name
        } at position: ${bot.vecToString(opponentWithFlag.position)}`
      );
      await usePotionOfType(bot, POTION_TYPE.MOVEMENT);

      await bot.attackEntity(opponentWithFlag);
      return true;
    }
  }
  return false;
}

/**
 * @param {RGBot} bot
 * @param {RGCTFUtils} rgCtfUtils
 * @param {Entity[]} opponents
 * @param {Entity[]}teamMates
 * @return {Promise<boolean>}
 */
async function handleAttackNearbyOpponent(
  bot,
  rgCtfUtils,
  opponents,
  teamMates
) {
  const myPosition = bot.position();

  const theOpponents = opponents.filter((op) => {
    return (
      op.position.distanceSquared(myPosition) <=
      (rgCtfUtils.hasFlag() ? 25 : 100)
    );
  });

  console.log(`Checking ${theOpponents.length} opponents in range to murder`);
  if (theOpponents.length > 0) {
    const firstOpponent = theOpponents[0];

    console.log(
      `Attacking opponent at position: ${bot.vecToString(
        firstOpponent.position
      )}`
    );

    await bot.attackEntity(firstOpponent, {
      reach: 3,
    });
    return true;
  }
  return false;
}

/**
 * @param {RGBot} bot
 * @param {RGCTFUtils} rgCtfUtils
 * @param {Entity[]} opponents
 * @param {Entity[]}teamMates
 * @return {Promise<boolean>}
 */
async function handleScoringFlag(bot, rgCtfUtils, opponents, teamMates) {
  if (rgCtfUtils.hasFlag()) {
    console.log(`I have the flag, running to score`);

    const myTeamName = bot.getMyTeam();

    const myScoreLocation =
      myTeamName === "BLUE"
        ? rgCtfUtils.BLUE_SCORE_LOCATION
        : rgCtfUtils.RED_SCORE_LOCATION;
    await moveTowardPosition(bot, myScoreLocation, 1);
    return true;
  }
  return false;
}

/**
 * @param {RGBot} bot
 * @param {RGCTFUtils} rgCtfUtils
 * @param {Entity[]} opponents
 * @param {Entity[]}teamMates
 * @return {Promise<boolean>}
 */
async function handleCollectingFlag(bot, rgCtfUtils, opponents, teamMates) {
  /** @type {Vec3} */
  const flagLocation = rgCtfUtils.getFlagLocation();
  if (flagLocation) {
    console.log(`Moving toward the flag at ${bot.vecToString(flagLocation)}`);
    // TODO: Do I need to use potions ? un-equip my shield to run faster ?
    await moveTowardPosition(bot, flagLocation, 1);
    return true;
  }
  return false;
}

/** @type {string[]} */
const placeableBlockDisplayNames = [
  "Gravel",
  "Grass Block",
  "Dirt",
  "Stripped Dark Oak Wood",
];

/** @type {Vec3[]} */
const blue_block_placements = [
  // bridge blockade
  new Vec3(81, 65, -387),
  new Vec3(81, 66, -387),
  new Vec3(81, 65, -385),
  new Vec3(81, 66, -385),
];

/** @type {Vec3[]} */
const red_block_placements = [
  // bridge blockade
  new Vec3(111, 65, -387),
  new Vec3(111, 66, -387),
  new Vec3(111, 65, -385),
  new Vec3(111, 66, -385),
];

async function handlePlacingBlocks(bot, rgCtfUtils, opponents, teamMates) {
  const myPosition = bot.position();

  const myTeamName = bot.getMyTeam();

  const theOpponents = opponents
    .filter((op) => {
      return Math.abs(op.position.y - myPosition.y) < 5;
    })
    .filter((op) => {
      return op.position.distanceSquared(myPosition) <= 225;
    });

  console.log(
    `Checking ${theOpponents.length} opponents in range before getting items or placing blocks`
  );
  if (theOpponents.length === 0) {
    const blockInInventory = bot.getAllInventoryItems().find((item) => {
      return placeableBlockDisplayNames.includes(item.displayName);
    });

    if (blockInInventory) {
      console.log(`I have a '${blockInInventory.displayName}' block to place`);

      const block_placements =
        myTeamName === "BLUE" ? blue_block_placements : red_block_placements;
      for (const location of block_placements) {
        const block = bot.mineflayer().blockAt(location);

        const rangeSq = location.distanceSquared(myPosition);
        console.log(
          `Checking for block: ${block && block.type} at rangeSq: ${rangeSq}`
        );
        if (rangeSq <= 400) {
          if (!block || block.type === 0 /*air*/) {
            console.log(
              `Moving to place block '${blockInInventory.displayName}' at: ${location}`
            );
            await moveTowardPosition(bot, location, 3);

            if (location.distanceSquared(myPosition) < 15) {
              console.log(
                `Placing block '${blockInInventory.displayName}' at: ${location}`
              );

              await bot.mineflayer().equip(blockInInventory, "hand");

              await bot
                .mineflayer()
                .placeBlock(
                  bot.mineflayer().blockAt(location.offset(0, -1, 0)),
                  new Vec3(0, 1, 0)
                );
            }
            return true;
          }
        }
      }
    } else {
      console.log(`No placeable blocks in inventory`);
    }
  }
  return false;
}

async function handleLootingItems(bot, rgCtfUtils, opponents, teamMates) {
  const myPosition = bot.position();

  const item = bot
    .findItemsOnGround({
      maxDistance: 33,
      maxCount: 5,
      itemValueFunction: (blockName) => {
        return bot.inventoryContainsItem(blockName) ? 999999 : 1;
      },
      sortValueFunction: (distance, pointValue) => {
        return distance * pointValue;
      },
    })
    .filter((theItem) => {
      return Math.abs(theItem.result.position.y - myPosition.y) < 5;
    })
    .map((t) => t.result)
    ?.shift();

  if (item) {
    console.log(
      `Going to collect item: ${item.name} at: ${bot.vecToString(
        item.position
      )}`
    );

    await moveTowardPosition(bot, item.position, 1);
    return true;
  }
  return false;
}

async function handleBotIdlePosition(bot, rgCtfUtils, opponents, teamMates) {
  console.log(
    `Moving toward center point: ${bot.vecToString(rgCtfUtils.FLAG_SPAWN)}`
  );
  await moveTowardPosition(bot, rgCtfUtils.FLAG_SPAWN, 1);
  return true;
}

module.exports = {
  handleLowHealth,
  handleAttackFlagCarrier,
  handleAttackNearbyOpponent,
  handleScoringFlag,
  handleCollectingFlag,
  handlePlacingBlocks,
  handleLootingItems,
  handleBotIdlePosition,
};
