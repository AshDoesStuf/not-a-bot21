const { RGBot } = require('rg-bot');
const { RGMatchInfo } = require('rg-match-info');
const { RGCTFUtils, CTFEvent } = require('rg-ctf-utils');
const {
  handleAttackFlagCarrier,
  handleAttackNearbyOpponent,
  handleBotIdlePosition,
  handleCollectingFlag,
  handleLootingItems, handleLowHealth,
  handlePlacingBlocks, handleScoringFlag
} = require('./lib/MainLoopFunctions');

const armorManager = require('mineflayer-armor-manager')

const {
  getUnbreakableBlockIds,
  nearestTeammates,
  nameForItem
} = require('./lib/HelperFunctions')


let rgCtfUtils = null
let unbreakable = null

/**
 * This capture the flag bot covers most possibilities you could have in a main loop bot.
 * Macro level strategies and tuning are up to you.
 * @param {RGBot} bot The configurable RGBot
 */
export function configureBot(bot) {

  // Disable rg-bot debug logging.  You can enable this to see more details about rg-bot api calls
  bot.setDebug(false)

  // Allow parkour so that our bots pathfinding will jump short walls and optimize their path for sprint jumps.
  bot.allowParkour(true)

  // We recommend disabling this on as you can't dig the CTF map.  Turning this on can lead pathfinding to get stuck.
  bot.allowDigWhilePathing(false)

  // Setup the rg-ctf-utils with debug logging
  rgCtfUtils = new RGCTFUtils(bot)
  rgCtfUtils.setDebug(true)

  bot.mineflayer().loadPlugin(armorManager)

  unbreakable = getUnbreakableBlockIds(bot)
}

/**
 * @param {RGBot} bot 
 */
export async function runTurn(bot) {

  try {
    const myTeamName = bot.getMyTeam()

    const myPosition = bot.position()

    const teamMates = nearestTeammates(bot, 33, true)

    const opponentNames = bot.getOpponentUsernames()

    const opponents = bot.findEntities({
      entityNames: (opponentNames.length === 0 && ['...']) || opponentNames,
      attackable: true,
      maxCount: 3,
      maxDistance: 33, 
      entityValueFunction: (entityName) => {
        return 0
      },
      // just sort them by distance for now... We'll filter them by decision point later
      sortValueFunction: (distance, entityValue, health = 0, defense = 0, toughness = 0) => {
        return distance
      }
    }).map(fr => fr.result)

    bot.mineflayer().armorManager.equipAll()

    let didSomething = false

    if (!didSomething) {
      // Check if I'm low on health
      didSomething = await handleLowHealth(bot, rgCtfUtils, opponents, teamMates)
    }

    if (!didSomething) {
      // if someone has the flag, hunt down player with flag if it isn't a team-mate
      didSomething = await handleAttackFlagCarrier(bot, rgCtfUtils, opponents, teamMates)
    }

    if (!didSomething) {
      // do I need to attack a nearby opponent
      didSomething = await handleAttackNearbyOpponent(bot, rgCtfUtils, opponents, teamMates)
    }

    if (!didSomething) {
      // if I have the flag, go score
      didSomething = await handleScoringFlag(bot, rgCtfUtils, opponents, teamMates)
    }

    if (!didSomething) {
      // go pickup the loose flag
      didSomething = await handleCollectingFlag(bot, rgCtfUtils, opponents, teamMates)
    }

    if (!didSomething) {
      // we had nothing to do ... move towards the middle
      didSomething = await handleBotIdlePosition(bot, rgCtfUtils, opponents, teamMates)
    }

  } catch (ex) {
    // if we get anything other than a pathfinding change error, log it so that we can fix our bot
    if (!(ex.toString().includes('GoalChanged') || ex.toString().includes('PathStopped'))) {
      console.warn(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.warn(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.warn(`Error during bot execution`, ex)
      console.warn(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.warn(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      await bot.wait(20) // wait 1 seconds before looping again to avoid tight loops on errors
    }
  }

}