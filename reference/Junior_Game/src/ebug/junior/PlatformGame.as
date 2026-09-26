/**
 * @author sbbc231
 */

import ebug.*;
import ebug.junior.*;
import ebug.general.*;
import flash.display.BitmapData;
import mx.data.components.WebServiceConnector;
import mx.data.encoders.Bool;
import mx.data.types.Str;

import mx.controls.TextArea;

class ebug.junior.PlatformGame extends Game{
	var player : Player;
	
	var timeLeft : TextField;
	
	var talkie : Talkie;
	
	var mapBuilder:MapBuilder;
	var level:Level;
	var nextLevel:String;
	
	// this is a bit hacky - want to be able to differentiate between body and outside so we can treat soap and white blood
	// as same in most code but choose the appropriate one.
	var bodyLevel : Boolean;

	//	stores the base tile movies which are cloned for on-screen cells
	var tiles:Array;

	//	stores movies for all currently instanced  tiles
	var cells:Array;

	//	as the screen scrolls, local positions need offset by how far into the level we are
	//  these variables count in columns, not pixels.
	var leftMostColumn:Number;
	var rightMostColumn:Number;
	
	// this number is added or subtracted from entity position in order to accurately draw on screen.
	// counts in pixels and is used to position movie clips.
	var pixelOffset:Number;

	public static var SCROLL_MARGIN_RIGHT : Number = 450;
	public static var SCROLL_MARGIN_LEFT : Number = 250;

	var accelerationSpeed:Number;
	
		
	// TODO drop jump count - keep max jumps 2 but make reload dependant on contact with ground.
	public static var MAX_JUMPS : Number = 2;
	public static var JUMP_COUNT : Number = 5;

	var exitReason : Number;
	public static var END_REASON_TIME : Number = 0;
	public static var END_REASON_DIE : Number = 1;
	public static var END_REASON_COMPLETE : Number = 2;
	
	var secondsTimer : Number;
	var secondsLeft : Number;
	
	
	// contains all game entities
	// each index is an array containing information on the game entity
	var entities:Array;
	
	// contains events that affect entity states
	var entityEvents : Array;
	
	// indexed by row then col.  Contents is index of staticEntities entity for this tile.
	var staticEntities : Array; 
	
	// player is always the first game entity in the entities array
	public static var PLAYER_INDEX:Number = 0;
	
	// track portal entity
	public var portalId : Number;
	
	var keyListener : Object;

	// used to run simulations of the avatar and also falling items.
	var particleSystem:ParticleSystem;
	
	var clipLoader : ClipLoader;

	var ePhone : EPhone;
	var score : Number;
	
	var fpscounter : Number = 0;
	var fpstimer : Number = 0;
	var fps : Number = 0;
	var averageFps : Number = 0;
	var numFpsChecks : Number = 0;
	var mainTimes : Array = new Array();
	var testUnloadTimer : Number = 0;
	
	// used for restarting level
	var roundStartPlayer : Player;
	var roundStartLevel : String;
	
	function PlatformGame()
	{
		level = new Level();
		tiles = new Array();
		cells = new Array();
		entities = new Array();
		pixelOffset = 0;
		entityEvents = new Array();
		
/*		// TODO move to player?
		jumpForce = gravity * 1000;
		accelerationSpeed = 2000;
*/	
		debug = false;
		clipLoader = new ClipLoader();
		portalId = 0;
		// 'this' is the movie 'game' inside the swf - so this->parent is the root of this hoverboard swf.
		ePhone = this._parent["ephone"];
		talkie = this._parent["talkie"];
		timeLeft = this._parent["timeLeft"];

		score = 0;
	}

	public function initialiseGame(inPlayer : Player, newLevel : String, inTiles : Array) : Void {
		trace("Init game - level == " + newLevel);
		mainTimes = new Array();
		for (var i = 0; i < 10; i++) {
			mainTimes[i] = 0;
		}
		//if (newLevel == undefined) newLevel = "antibiotic.xml";
		if (newLevel == undefined) newLevel = "alpha_level1.xml";
		//if (newLevel == undefined) newLevel = "super.xml";
		//if (newLevel == undefined) newLevel = "lacto.xml";
		gameState = Constants.STATE_INIT;
		// needed to level geometry
		mapBuilder = new MapBuilder(inTiles);
		nextLevel = newLevel;
		player = inPlayer;
	
		scrollDown = false;
		scrollUp = false;
		scrollLeft = false;
		scrollRight = false;
		dirtyScreen = true;
	
		secondsLeft = 180;
		
		var gravity : Vector3 = new Vector3(0, 3000, 0);
		var dampening : Number = .95;
		//var friction : Number = .5;
		particleSystem = new ParticleSystem(30, 1, new Vector3(), null, gravity, dampening, new Vector3(9999999, 9999999, 0), true);
			
		particleSystem.parent = this;
		particleSystem.debug = true;

		busy = false;
		busyString = "";
	
		this._parent["avatar"]._visible = false;
		
		// define what happens when the jpg is completely loaded
		//trace (" in PlatformGame code.  Player sex is ["+player.sex+"] and avatarsex is ["+player.avatarSex+"]");
		if ( player.avatarSex == Player.FEMALE ) {
			clipLoader.loadClip("amy.swf", this._parent["avatar"]);
		} else {
			clipLoader.loadClip("harry.swf", this._parent["avatar"]);
		} 
		
		// at present only supporting one screen - but using 'theScreen' allows for support of more
		ePhone.screen.attachMovie("status", "screen1", ePhone.getNextHighestDepth());
		ePhone.status = ePhone.screen.screen1;
		
		//talkie.init("David", "boya!", "popup", "end", null);
		// talkie has a mc called head in it that can hold pics - it is 160 x 80 anbd is only ther ein popup
		talkie._visible = false;
		
		for ( var i : Number = 0; i < (3); i++) {
			this._parent["heart"+i]._visible = true;
		}
		
		
		
	}
	
	public function restartRound() {
//		trace ("restarting round in platformgame");
//		trace ("with Player : " + roundStartPlayer.nickname + " and " + roundStartLevel);
		this.initialiseGame(roundStartPlayer, roundStartLevel, mapBuilder.tilesList);
		
	}

	public function main():Void {
		trace ("Total physics: " + particleSystem.dynamicEntities.length + " + " + particleSystem.staticEntities.length + " == " + (particleSystem.dynamicEntities.length + particleSystem.staticEntities.length));
		//trace("main");
		fpscounter = getTimer();
		if (fpscounter >= fpstimer + 1000) {
		//	_root["debugPanel"]["label3"].text = "FPS";
		//	_root["debugPanel"]["value3"].text = fps;
			//_root["fps"].text = fps;
			
			var outputText : String = "timings: ";
			for ( var i = 0; i < mainTimes.length; i++) {
				outputText += "[" + mainTimes[i] +"]";
				mainTimes[i] = 0;
			}
			_root["debugOutput"].text = outputText;
			
			averageFps += fps;
			numFpsChecks ++;
			if (numFpsChecks >= 9) {
				trace ("average FPS("+averageFps+" / 10): " + Math.floor(averageFps/10) + " curr: " + fps);
				
//				_root["debugPanel"]["label4"].text = "Average FPS";
	//			_root["debugPanel"]["value4"].text = (Math.floor(averageFps/10));
				
				numFpsChecks = 0;
				averageFps = 0;
			}
			fps = 0;
			fpstimer = getTimer();
		} else {
			fps++;
		}
		
		
		//busy = true;
		if (!busy) {
			switch(this.gameState) {
				case Constants.STATE_INIT:
					var mainTimeStart : Number = getTimer();
					this.screenTopLeft = new Point(0,0);
					this.screenBottomRight = new Point(Constants.SCREEN_WIDTH, Constants.SCREEN_HEIGHT);
					this.gameState = Constants.STATE_LOAD_LEVEL;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_INIT] += timePassed;
					break;
				case Constants.STATE_LOAD_LEVEL:
					var mainTimeStart : Number = getTimer();
					this.mapBuilder.loadLevel("../levels/"+ this.nextLevel);
					this.gameState = Constants.STATE_LEVEL_LOADING;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_LOAD_LEVEL] += timePassed;
					break;
				case Constants.STATE_LEVEL_LOADING:
					var mainTimeStart : Number = getTimer();
					this.isLevelLoaded();
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_LEVEL_LOADING] += timePassed;
					break;
				case Constants.STATE_LEVEL_LOADED:
					var mainTimeStart : Number = getTimer();
					this.level = mapBuilder.level;
					bodyLevel = level.bodyLevel;
					trace ("bodylevel: " + bodyLevel);
					particleSystem.worldMin = new Vector3(0, -100, 0);
					particleSystem.worldMax = new Vector3(level.cols*Constants.TILE_WIDTH, 450, 0);
					
					// TODO should come from level def

					this.gameState = Constants.STATE_LOAD_TILES;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_LEVEL_LOADED] += timePassed;
					break;
				case Constants.STATE_LOAD_TILES:
					var mainTimeStart : Number = getTimer();
					busy = true;
					busyString = "State: " + gameState;

					// load clips
					for (var i:Number = 0; i < this.level.tiles.length; i++) {
						var tempClip:MovieClip = this.attachMovie(this.level.tiles[i].movie, "tile" + i, this.getNextHighestDepth());
						tempClip.stop();
						tempClip.libName = this.level.tiles[i].movie;
						tempClip._x = 0 - tempClip._width;
						tempClip._y = 0 - tempClip._height;
						tempClip._visible = false;
						this.tiles.push(tempClip);
					}

					// enter tile positions and their bounding boxes into the physics system.
					// the static non-entity tiles don't move - so this is set once and not updated every frame.
					for (var currentRow:Number = 0; currentRow < level.rows; currentRow++) {
						for (var currentCol:Number = 0; currentCol <= level.cols; currentCol++) {
							if ( !isNaN(level.levelDataGeometry[currentRow][currentCol]) ) {
								var currentClip:MovieClip = this["tile" + level.levelDataGeometry[currentRow][currentCol]];
								//position:Vector3, clip:MovieClip, dynamicEntity:Boolean, force:Vector3, gravityExcempt:Boolean,
								var position:Vector3 = new Vector3( currentCol * Constants.TILE_WIDTH, currentRow * Constants.TILE_WIDTH , 0);
								
								if (staticEntities[currentRow] == undefined) {
									staticEntities[currentRow] = new Array();	
								}
								staticEntities[currentRow][currentCol] = particleSystem.createBoxParticle(position, currentClip, false);
								particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = true;
								
							}
						}
					}
					//trace("level array: " + particleSystem.levelTileArray.length);
					var levelTileArray : Array = particleSystem.levelTileArray;
					for (var row:Number = 0; row < levelTileArray.length; row++) {
						var line: String = "";
						for (var col: Number = 0; col < levelTileArray[row].length; col++) {
							if ( isNaN(levelTileArray[row][col]) && levelTileArray[row][col] != " ") {
								levelTileArray[row][col] = " ";
							}
							line += "[" + levelTileArray[row][col] + "]";
						}
					//	trace(line);
					}
					

					busy = false;
					busyString = "";
					this.gameState = Constants.STATE_CREATE_GUI;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_LOAD_TILES] += timePassed;
					break;
				case Constants.STATE_CREATE_GUI:
				
				//_root["fps"].text = "state create gui";
					var mainTimeStart : Number = getTimer();
					
					
					if ( level.goals.length > 0) {
						var goal : Goal = Goal(level.goals[0]);
						ePhone.status.nextButton = 1;
						if (goal.goalType == Goal.PHOTOGRAPH_GOOD ) {
							ePhone.status.background.attachMovie("lucy_image", "this", ePhone.status.background.getDepth());
							ePhone.status.mode.attachMovie("camera_icon", "this", ePhone.status.mode.getDepth());
						} else if (goal.goalType == Goal.PHOTOGRAPH_SPECIFIC ) {
							ePhone.status.mode.attachMovie("camera_icon", "this", ePhone.status.mode.getDepth());

							if ( goal.microbeType == Constants.GAME_ENTITY_LUCY ) {
								ePhone.status.background.attachMovie("lucy_image", "this", ePhone.status.background.getDepth());
							} else if ( goal.microbeType == Constants.GAME_ENTITY_STEVE ) {
								ePhone.status.background.attachMovie("steve_image", "this", ePhone.status.background.getDepth());
							} else if ( goal.microbeType == Constants.GAME_ENTITY_SANDY ) {
								ePhone.status.background.attachMovie("sandy_image", "this", ePhone.status.background.getDepth());
							} else if ( goal.microbeType == Constants.GAME_ENTITY_SLARG ) {
								ePhone.status.background.attachMovie("slarg_image", "this", ePhone.status.background.getDepth());
							} else if ( goal.microbeType == Constants.GAME_ENTITY_SLURM ) {
								ePhone.status.background.attachMovie("slurm_image", "this", ePhone.status.background.getDepth());
							} 
						} else if ( goal.goalType == Goal.YOGURT) {
							ePhone.status.background.attachMovie("milk_image", "this", ePhone.status.background.getDepth());
						} else if ( goal.goalType == Goal.ANTIBIOTIC) {
							ePhone.status.background.attachMovie("superinfection_image", "this", ePhone.status.background.getDepth());
						} else {
							ePhone.status.background.attachMovie("slurm_image", "this", ePhone.status.background.getDepth());
							ePhone.status.mode.attachMovie("kill_icon", "this", ePhone.status.mode.getDepth());
						}
						for ( var i : Number = 0; i < goal.required; i++) {
							ePhone.status["button"+ (i+1)].gotoAndPlay("empty");
						}
					}	
					
					
					this.gameState = Constants.STATE_CREATE_ENTITIES;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_CREATE_GUI] += timePassed;
					break;
				case Constants.STATE_CREATE_ENTITIES:
					var mainTimeStart : Number = getTimer();
					// instanciate player entity first for easy access
					var playerPosition:Vector3 = this.level.uniqueItems[Constants.GAME_ENTITY_PLAYER];
					playerPosition = playerPosition.multiply(Constants.TILE_WIDTH);
				
					
					var playerEntity : PlayerEntity;
					
					playerEntity = new PlayerEntity(this, null, _parent.avatar, MAX_JUMPS); 
					//change!
					playerEntity.lives = 3;

					playerEntity.clip._x = playerPosition.x;
					playerEntity.clip._y = playerPosition.y;
					playerEntity.clip.swapDepths(this.getNextHighestDepth());

					playerEntity.particle = particleSystem.dynamicEntities[ particleSystem.createBoxParticle(playerPosition, playerEntity.clip, true, new Vector3(), false, false, new Vector3(49,100,0)) ];
					playerEntity.particle.theParent = playerEntity;
					playerEntity.isOnScreen = true;
					playerEntity.particle.physicsExcempt = false;
					
					playerEntity.particleArrayId = PlatformGame.PLAYER_INDEX;
					playerEntity.particleIsDynamic = true;
					
					playerEntity.state = PlayerEntity.PLAYER_STATE_NORMAL;
					playerEntity.speed = particleSystem.gravity.y * 1.5 ;
					playerEntity.jumpForce = particleSystem.gravity.y * 8;
					
					// place player in proper game entities array
					entities.push(playerEntity);
					playerEntity.indexId = 0;
					mapControls(playerEntity);
					playerEntity.type = Constants.GAME_ENTITY_PLAYER;
					
					
					// now loop around level's levelDataEntities array and hook up game entities with behaviour.
					//trace ("level data entities contains "+ level.levelDataEntities.length +" elements");
					for (var currentRow:Number = 0; currentRow < this.level.levelDataEntities.length; currentRow++) {
						for (var currentCol:Number = 0; currentCol < this.level.levelDataEntities[currentRow].length; currentCol++) {
							if ( level.levelDataEntities[currentRow][currentCol] == undefined ) {
								//trace ("ignoring " + currentCol + "," + currentRow);
								//; //if no entity found, safely ignore
							} else {
								// exclude player (catered for above)
								var entityDefinition : Number = this.level.tiles[this.level.levelDataEntities[currentRow][currentCol]];
								//trace ("entityDefinition: " + entityDefinition);
								if (entityDefinition["type"] != Constants.GAME_ENTITY_PLAYER ) {
									var gameEntityPosition : Vector3 = (new Vector3(currentCol, currentRow)).multiply(Constants.TILE_WIDTH);
									var gameEntityClip : MovieClip = this.attachMovie(entityDefinition["movie"], entityDefinition["movie"]+"_r"+currentRow+"_c"+currentCol, this.getNextHighestDepth(), {_x:gameEntityPosition.x, _y:gameEntityPosition.y, type:entityDefinition["type"]});
									
									var gameEnt : GameEntity ;
									var gameEntityParticle : EntityBox; 
									// good microbes first
									if ( entityDefinition["type"] == Constants.GAME_ENTITY_GOOD_MICROBE  || entityDefinition["type"] == Constants.GAME_ENTITY_GENERIC
										|| entityDefinition["type"] == Constants.GAME_ENTITY_SANDY 
										|| entityDefinition["type"] == Constants.GAME_ENTITY_STEVE || entityDefinition["type"] == Constants.GAME_ENTITY_PATTY ) {
										gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
										gameEntityParticle.physicsExcempt = true;
	//									if ( entityDefinition["movie"] == "lucy_icon" ) {
	//										gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
	//									} else {
										gameEnt = new GoodMicrobe(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
	//									}
										gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
										gameEnt.particleIsDynamic = true;
										gameEnt.isOnScreen = true; 		
										gameEnt.type = entityDefinition["type"];			
										gameEnt.particle.theParent = gameEnt;
									} else if (entityDefinition["type"] == Constants.GAME_ENTITY_LUCY ) {
										gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
										gameEntityParticle.physicsExcempt = true;
	//									if ( entityDefinition["movie"] == "lucy_icon" ) {
	//										gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
	//									} else {
										gameEnt = new LucyLactobacillus(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
	//									}
										gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
										gameEnt.particleIsDynamic = true;
										gameEnt.isOnScreen = true; 		
										gameEnt.type = entityDefinition["type"];			
										gameEnt.particle.theParent = gameEnt;
									}// now bad microbres
									  else if ( entityDefinition["type"] == Constants.GAME_ENTITY_BAD_MICROBE || entityDefinition["type"] == Constants.GAME_ENTITY_COLIN
												|| entityDefinition["type"] == Constants.GAME_ENTITY_DONNA || entityDefinition["type"] == Constants.GAME_ENTITY_IGGY 
												|| entityDefinition["type"] == Constants.GAME_ENTITY_SLARG || entityDefinition["type"] == Constants.GAME_ENTITY_SLURM ) {
										gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true)];
										gameEntityParticle.physicsExcempt = true;
										gameEnt = new BadMicrobe(this, currentRow, currentCol, gameEntityParticle, gameEntityClip);
										gameEnt.particleArrayId = particleSystem.dynamicEntities.length -1;
										gameEnt.particleIsDynamic = true;
										gameEnt.isOnScreen = true; 		
										gameEnt.type = entityDefinition["type"];			
										gameEnt.particle.theParent = gameEnt;
									} // now onto entities such as ammo and portals etc...
									  else if ( entityDefinition["type"] == Constants.GAME_ENTITY_AMMO_PICKUP ) {
										gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
										gameEntityParticle.physicsExcempt = true;
										if ( bodyLevel ) {
											gameEnt = new WhitePickup(this, gameEntityParticle, gameEntityClip);
										} else {
											gameEnt = new SoapPickup(this, gameEntityParticle, gameEntityClip);
										}
										gameEnt.particleIsDynamic = false;
										gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
										gameEnt.isOnScreen = true; 
										gameEnt.type = Constants.GAME_ENTITY_AMMO_PICKUP;
										gameEnt.particle.theParent = gameEnt;
									
										particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
									} else if ( entityDefinition["type"] == Constants.GAME_ENTITY_MILK ) {
										gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true, null, true, true)];
										gameEntityParticle.physicsExcempt = false;
										gameEnt = new MilkGlassEntity(this, gameEntityParticle, gameEntityClip);
										gameEnt.particleIsDynamic = true;
										gameEnt.particleArrayId = particleSystem.dynamicEntities.length - 1;
										gameEnt.isOnScreen = true; 
										gameEnt.type = Constants.GAME_ENTITY_MILK;
										gameEnt.particle.theParent = gameEnt;
									} else if ( entityDefinition["type"] == Constants.GAME_ENTITY_PORTAL_EXIT ) {
										gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
										gameEntityParticle.physicsExcempt = true;
										gameEnt = new PortalEntity(this, gameEntityParticle, gameEntityClip);
										gameEnt.particleIsDynamic = false;
										gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
										gameEnt.isOnScreen = true; 
										gameEnt.type = Constants.GAME_ENTITY_PORTAL_EXIT;
										gameEnt.particle.theParent = gameEnt;
										portalId = entities.length;
										particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
									} else if ( entityDefinition["type"] == Constants.GAME_ENTITY_ANTIBIOTIC_PICKUP ) {
										gameEntityParticle = particleSystem.staticEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, false, null, true, true)];
										gameEntityParticle.physicsExcempt = true;
										
										gameEnt = new AntibioticPickup(this, gameEntityParticle, gameEntityClip);

										gameEnt.particleIsDynamic = false;
										gameEnt.particleArrayId = particleSystem.staticEntities.length - 1;
										gameEnt.isOnScreen = true; 
										gameEnt.type = Constants.GAME_ENTITY_ANTIBIOTIC_PICKUP;
										gameEnt.particle.theParent = gameEnt;
									
										particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][gameEnt.particleArrayId] = true;
									}  else if ( entityDefinition["type"] == Constants.GAME_ENTITY_SUPERINFECTION ) {
										gameEntityParticle = particleSystem.dynamicEntities[particleSystem.createBoxParticle(gameEntityPosition, gameEntityClip, true, null, true, true)];
										gameEntityParticle.physicsExcempt = false;									
										gameEnt = new SuperInfection(this, gameEntityParticle, gameEntityClip);

										gameEnt.particleIsDynamic = true;
										gameEnt.particleArrayId = particleSystem.dynamicEntities.length - 1;
										gameEnt.isOnScreen = true; 
										gameEnt.type = Constants.GAME_ENTITY_SUPERINFECTION;
										gameEnt.particle.theParent = gameEnt;
									
									} 
									//trace ("Game Entity Type: " + gameEnt.type + " is: " + gameEnt);
									gameEnt.indexId = entities.length;
									entities.push( gameEnt );
									
									
								}
							}
						} 	
					}
					
					this.gameState = Constants.STATE_INIT_DIALOGUE;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_CREATE_ENTITIES] += timePassed;
					break;
				case Constants.STATE_INIT_DIALOGUE:
					var mainTimeStart : Number = getTimer();
					if (!ePhone.isLarge) {
						ePhone.swapDepths(this.getNextHighestDepth());
						
						ePhone.grow(level.name);
					} else if ( ePhone.bigScreen.finished ) {
						ePhone.shrink();
						secondsTimer = getTimer();
						gameState = Constants.STATE_UPDATE_WORLD;
					}
					//gameState = Constants.STATE_UPDATE_WORLD;
					break;
				case Constants.STATE_UPDATE_WORLD:
					var mainTimeStart : Number = getTimer();
					//trace ("update");
					
					//check timeleft
					if ( getTimer() - secondsTimer >= 1000) {
						secondsTimer = getTimer();
						secondsLeft--;
						timeLeft.htmlText = "<b>"+secondsLeft+"</b>";
						//trace (secondsLeft);
						if ( secondsLeft < 0 ) {
							secondsLeft = 0;
							
							entityEvents.push(new Event(Event.TRIGGER_GAME_END, null, null));  
							exitReason = END_REASON_TIME;
						}
					}
					
					
					/* 
					 * Check to see if we can skip all this and go to next level
					 */
					var allGoalsAchieved : Boolean = true;
					for ( var i : Number = 0; i < level.goals.length; i++) {
						if ( level.goals[i].isGoalMet() == false ) {
							allGoalsAchieved = false;	
						}
					}
						
					if ( allGoalsAchieved == false) {  
						//trace ("not met goals : " + Goal(level.goals[0]).achieved + " vs " + Goal(level.goals[0]).required);
						/*for ( var i : Number = 0; i < Goal(level.goals[0]).achieved; i++) {
							trace("not met goals");
							ePhone.status["button" + (i + 1)].gotoAndPlay("tick");
						}*/
					} else if ( entities[portalId].state == PortalEntity.PORTAL_STATUS_CLOSED ) {	
						level.goals.pop();
						//trace("portal closed");
						ePhone.status.background.attachMovie("exit_status", "this", ePhone.status.background.getDepth());
						entityEvents.push(new Event(PortalEntity.PORTAL_EVENT_OPEN, entities[portalId], null));  
					}
					if ( PlayerEntity(entities[0]).lives <= 0) {
							entityEvents.push(new Event(Event.TRIGGER_GAME_END, null, null));  
							exitReason = END_REASON_DIE;
					} 
					var numLives : Number = 3;
					for ( var i : Number = 0; i < (numLives - PlayerEntity(entities[0]).lives); i++) {
						this._parent["heart"+i]._visible = false;
					}
					
				
					// this is where we move stuff and check actions
					if (scrollLeft) {
						this.moveScreenLeft();
						this.dirtyScreen = true;
					}
					if (scrollRight) {
						this.moveScreenRight();
						this.dirtyScreen = true;
					}
					if (this.dirtyScreen) {
						this.gameState = Constants.STATE_RENDER_WORLD;
						this.dirtyScreen = false;
					}
				
					var numBullets : Number = 0;
					// update non-physics entities first, because physics entities are cleverer about resolving conflicts
					for (var i:Number = 0; i < entities.length; i++) {
						if ( entities[i].isOnScreen == true ) {
							//trace ("advance  entity " + i);
							if ( GameEntity(entities[i]).type == Constants.GAME_ENTITY_BULLET ) {
								numBullets ++;
							}
							var newEvents : Array = GameEntity(entities[i]).advance();
							if ( newEvents != null ) {
								entityEvents = entityEvents.concat(newEvents);
							}							
						} 
					}
					trace ("There were: " + numBullets);
					// do any entities need to have events resolved?
					//trace("now resolve entity events");
				//	var eventsString = "";
					while ( entityEvents.length > 0 ) {
				//		eventsString += "\nevents left: " + entityEvents.length;
						var currentEvent : Event = Event(entityEvents.shift());
						var newEvents : Array = new Array();
					//	eventsString += " - et:" + currentEvent.type + "- t:" + currentEvent.target + " - p: " + currentEvent.params[0];
						// 'normal' events get passed to each entity itself
						
						if ( currentEvent.type == Event.BE_HURT ) {
							trace ("got be hurt event - target is: " + currentEvent.target.type);
						}
						switch ( currentEvent.type ) {
							case Event.COLLIDE :
							//trace ("Collision: " + currentEvent.target.type + " and " + currentEvent.params[0].type);
								if ( currentEvent.target.type == Constants.GAME_ENTITY_AMMO_PICKUP && currentEvent.params[0].type == Constants.GAME_ENTITY_PLAYER) {
									newEvents = currentEvent.target.act(currentEvent);
									
									var params : Array = new Array();
									params.push(7);	
									//trace(" 7 Points");
									var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
									entityEvents.push(pointsEvent);
							
								} else if ( currentEvent.target.type == Constants.GAME_ENTITY_BAD_MICROBE && currentEvent.params[0].type == Constants.GAME_ENTITY_BULLET) {
									var params : Array = new Array();
									params.push(3);	
								//	trace(" 3 Points");
									var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
									entityEvents.push(pointsEvent);
									
									newEvents = currentEvent.target.act(currentEvent);	
								} else  {
									newEvents = currentEvent.target.act(currentEvent);
								}	
								break;
							case Event.CREATE_SOAP_BULLET :
								trace("soap bullet");
								if ( bodyLevel == false) {
									var playerEntity : GameEntity = entities[PlatformGame.PLAYER_INDEX];
									var position : Vector3 = playerEntity.particle.position.clone();
									var clipX : Number = playerEntity.clip._x;
									var clipY : Number = playerEntity.clip._y + PlayerEntity.SHOOT_POINT;
									position.y = clipY;
									var clip : MovieClip = this.attachMovie("soap_projectile", "soapProjectile" + getTimer(), this.getNextHighestDepth(), {_x: clipX, _y: clipY});
									if ( playerEntity.direction == GameEntity.RIGHT ) {
										var playerSpeed : Number = Math.abs( playerEntity.particle.position.x - playerEntity.particle.previousPosition.x );
										clip._x = playerEntity.clip._x + playerEntity.clip._width - clip._width;	
										position.x = playerEntity.particle.position.x + playerEntity.clip._width - clip._width;
									} else {
										clip._x = playerEntity.clip._x - clip._width;
										position.x = playerEntity.particle.position.x - clip._width ; 
									} 
									var force : Vector3 = playerEntity.particle.position.subtract(playerEntity.particle.previousPosition);
									force.y = 0;
									var particle : EntityBox = particleSystem.dynamicEntities[particleSystem.createBoxParticle(position, clip, true, force, false, true, new Vector3(50,25,0))];
									var soapProjectile : BulletEntity = new BulletEntity(this, particle, clip, false, true, false, 1, 10, 10);
	//								if ( playerEntity.direction == GameEntity.RIGHT ) {
	//									particle.previousPosition = particle.position.add(playerEntity.particle.position.subtract(playerEntity.particle.previousPosition));
	//								}
									soapProjectile.type = Constants.GAME_ENTITY_BULLET;
									
									soapProjectile.particleArrayId = particleSystem.dynamicEntities.length - 1;
									soapProjectile.particleIsDynamic = true;							
									
									soapProjectile.direction = playerEntity.direction;
									soapProjectile.indexId = entities.length;
									
									entities.push(soapProjectile); 
									particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.DYNAMIC][soapProjectile.particleArrayId] = true;
									particleSystem.excemptionMatrix[soapProjectile.particleArrayId][ParticleSystem.DYNAMIC][PlatformGame.PLAYER_INDEX] = true;
								} else {
									currentEvent.type = Event.CREATE_WHITE_BULLET;
									entityEvents.push(currentEvent);
								}
								break;
							case Event.CREATE_WHITE_BULLET :
								trace("white bullet");
								
								var playerEntity : GameEntity = entities[PlatformGame.PLAYER_INDEX];
								var position : Vector3 = playerEntity.particle.position.clone();
								var clipX : Number = playerEntity.clip._x;
								var clipY : Number = playerEntity.clip._y + PlayerEntity.SHOOT_POINT;
								position.y = clipY;
								var clip : MovieClip = this.attachMovie("white_projectile", "whiteProjectile" + getTimer(), this.getNextHighestDepth(), {_x: clipX, _y: clipY});
								if ( playerEntity.direction == GameEntity.RIGHT ) {
									var playerSpeed : Number = Math.abs( playerEntity.particle.position.x - playerEntity.particle.previousPosition.x );
									clip._x = playerEntity.clip._x + playerEntity.clip._width - clip._width;	
									position.x = playerEntity.particle.position.x + playerEntity.clip._width - clip._width;
								} else {
									clip._x = playerEntity.clip._x - clip._width;
									position.x = playerEntity.particle.position.x - clip._width ; 
								} 
								var force : Vector3 = playerEntity.particle.position.subtract(playerEntity.particle.previousPosition);
								force.y = 0;
								var particle : EntityBox = particleSystem.dynamicEntities[particleSystem.createBoxParticle(position, clip, true, force, false, true, new Vector3(50,25,0))];
								var whiteProjectile : BulletEntity = new BulletEntity(this, particle, clip, false, true, false, 1, 10, 10);
//								if ( playerEntity.direction == GameEntity.RIGHT ) {
//									particle.previousPosition = particle.position.add(playerEntity.particle.position.subtract(playerEntity.particle.previousPosition));
//								}
								whiteProjectile.type = Constants.GAME_ENTITY_BULLET;
								
								whiteProjectile.particleArrayId = particleSystem.dynamicEntities.length - 1;
								whiteProjectile.particleIsDynamic = true;							
								
								whiteProjectile.direction = playerEntity.direction;
								whiteProjectile.indexId = entities.length;
								entities.push(whiteProjectile); 
								particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.DYNAMIC][whiteProjectile.particleArrayId] = true;
								particleSystem.excemptionMatrix[whiteProjectile.particleArrayId][ParticleSystem.DYNAMIC][PlatformGame.PLAYER_INDEX] = true;
								break;
							case Event.CREATE_CAMERA_FLASH :
								/*
								 * Things to note about the camera flash:
								 * it is created as a static entity as far as physics is concerned
								 * it is NOT added to the levelTileArray in the particle system - so dynamic entities don't check against it
								 * it IS added to the entities list in this class - so when entities are given time to think, the camera flash is amoungst them
								 * thus, the entities don't collide with the flash, the flash collides with them.
								 */
							
								var playerEntity : PlayerEntity = entities[PlatformGame.PLAYER_INDEX];
								
								var position : Vector3 = playerEntity.particle.position.clone();
								var clipX : Number = playerEntity.clip._x;
								var clipY : Number = playerEntity.clip._y + PlayerEntity.SHOOT_POINT;
								position.y = clipY;
								var clip : MovieClip = this.attachMovie("camera_flash", "cameraFlash" + getTimer(), this.getNextHighestDepth(), {_x: clipX, _y: clipY});
								if ( playerEntity.direction == GameEntity.RIGHT ) {
									var playerSpeed : Number = Math.abs( playerEntity.particle.position.x - playerEntity.particle.previousPosition.x );
									clip._x = playerEntity.clip._x + playerEntity.clip._width;	
									position.x = playerEntity.particle.position.x + playerEntity.clip._width;
								} else {
									clip._x = playerEntity.clip._x - clip._width;
									position.x = playerEntity.particle.position.x - clip._width - 2; 
								} 
								var force : Vector3 = new Vector3();
								var particle : EntityBox = particleSystem.staticEntities[particleSystem.createBoxParticle(position, clip, false, force, true, true)];
								var cameraFlash : CameraFlashEntity = new CameraFlashEntity(this, particle, clip);
								cameraFlash.type = Constants.GAME_ENTITY_CAMERA_FLASH;
								
								cameraFlash.particleArrayId = particleSystem.staticEntities.length - 1;
								cameraFlash.particleIsDynamic = false;	
								cameraFlash.particle.physicsExcempt = true;						
								
								cameraFlash.direction = playerEntity.direction;
								cameraFlash.indexId = entities.length;
								entities.push(cameraFlash); 
								particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.STATIC][cameraFlash.particleArrayId] = true;
								//particleSystem.excemptionMatrix[soapProjectile.particleArrayId][ParticleSystem.DYNAMIC][PlatformGame.PLAYER_INDEX] = true;
								break;
							case Event.PICKUP_ANTIBIOTIC : // antibiotic ammo - one held at a time
								this._parent["antibiotic_held"]._visible = true;
								(PlayerEntity( entities[PlatformGame.PLAYER_INDEX])).has_antibiotic = true;
								trace ("picked up anti");
								break;
							case Event.CREATE_ANTIBIOTIC : // creates the antibiotic bomb
								this._parent["antibiotic_held"]._visible = false;
								(PlayerEntity( entities[PlatformGame.PLAYER_INDEX])).has_antibiotic = false;
							
								
								// find player position and create bomb next to player 
								var playerEntity : PlayerEntity = PlayerEntity(entities[PlatformGame.PLAYER_INDEX]);
								var position : Vector3 = playerEntity.particle.position.clone();
								var clipX : Number = playerEntity.clip._x;
								var clipY : Number = playerEntity.clip._y + PlayerEntity.SHOOT_POINT;
								position.y = clipY;
								var clip : MovieClip = this.attachMovie("antibiotic_pickup", "antibiotic_bomb" + getTimer(), this.getNextHighestDepth(), { _x: clipX, _y: clipY } );
								if ( playerEntity.direction == GameEntity.RIGHT ) {
									clip._x = playerEntity.clip._x + playerEntity.clip._width - clip._width;	
									position.x = playerEntity.particle.position.x + playerEntity.clip._width - clip._width;
								} else {
									clip._x = playerEntity.clip._x - clip._width;
									position.x = playerEntity.particle.position.x - clip._width ; 
								} 
								
								var particle : EntityBox = particleSystem.dynamicEntities[particleSystem.createBoxParticle(position, clip, true, null, false, true, null)];
								var antibioticBomb : AntibioticBombEntity = new AntibioticBombEntity(this, particle, clip);
								antibioticBomb.type = Constants.GAME_ENTITY_ANTIBIOTIC_BOMB;
								
								antibioticBomb.particleArrayId = particleSystem.dynamicEntities.length - 1;
								antibioticBomb.particleIsDynamic = true;							
								
								antibioticBomb.direction = playerEntity.direction;
								antibioticBomb.indexId = entities.length;
								entities.push(antibioticBomb); 
								particleSystem.excemptionMatrix[PlatformGame.PLAYER_INDEX][ParticleSystem.DYNAMIC][antibioticBomb.particleArrayId] = true;
								particleSystem.excemptionMatrix[antibioticBomb.particleArrayId][ParticleSystem.DYNAMIC][PlatformGame.PLAYER_INDEX] = true;
								break;
							case Event.EXPLODE_ANTIBIOTIC :
								// find all entities on screen
								var onScreenEntities : Array = new Array();
								var pointsToGive : Number = 0;// +15 points for bad bug, -10 points for good bug
								
								// find bacteria on screen to kill - exception being superinfection which is dealt with seperately
								var superBugRef : Number;
								for (var i:Number = 0; i < entities.length; i++) {
									if ( entities[i].isOnScreen == true ) {
										if ( ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_LUCY) ||
											 ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_SANDY) ||
											 ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_STEVE) ||
											 ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_SLURM) ||
											 ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_SLARG) ||
											 ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_COLIN) ) {
												 
											onScreenEntities.push(entities[i]);
										} else if ( ((GameEntity(entities[i])).type == Constants.GAME_ENTITY_SUPERINFECTION) ) {
											superBugRef = i;
										}
									} 
								}
								//trace (" added " + onScreenEntities.length + " bacteria on screen - sb == " + superBugRef);
								
								// trigger death to all bacteria
								for ( var i: Number = 0; i < onScreenEntities.length; i++) {
									var currentEntity : GameEntity = GameEntity(onScreenEntities[i]);
									currentEntity.kill();
									if ( currentEntity.type == Constants.GAME_ENTITY_LUCY || currentEntity.type == Constants.GAME_ENTITY_SANDY 
										 || currentEntity.type == Constants.GAME_ENTITY_STEVE ) {
										pointsToGive -= 10;
									} else {
										pointsToGive += 15;
									}
								}
								
								// deal with superbug
								if ( !isNaN(superBugRef) ) {
									pointsToGive += 30;
									var hurtSuper : Event = new Event(Event.BE_HURT, entities[superBugRef], null);
									newEvents.push(hurtSuper);
									//trace ("new events size: + " + newEvents.length);
								}
								
								
								// assign points?
								var params : Array = new Array();
								params.push(pointsToGive);
								var givePoints : Event = new Event(Event.MODIFY_POINTS, entities[PLAYER_INDEX], params);
								newEvents.push(givePoints);
								
								// update goals
								for ( var i : Number = 0; i < level.goals.length; i++) { 
									var goal : Goal = level.goals[i];
									var goalevents : Array = goal.updateGoal(currentEvent);
									newEvents.push(goalevents.pop());
									//trace (goalevents.length + " goal events ("+goalevents[0].type+") added to new events == " + newEvents.length + " is " + newEvents[(newEvents.length - 1)].type);
								}
								
								// flash screen
								this._parent["whiteout"]._alpha = 100;
								//trace ("events added: ");

								break;
							case Event.REMOVE :
							trace("remove entity");
								var index : Number = Event(currentEvent).target.particleArrayId;
								var isDynamic :  Boolean = Event(currentEvent).target.particle.isDynamic;
								var entityId : Number = Event(currentEvent).target.indexId;
								
								newEvents = currentEvent.target.act(currentEvent);
								var exemptions : Array = new Array();
								
								if ( Event(currentEvent).target.type == Constants.GAME_ENTITY_CAMERA_FLASH ) {
									//trace ("remove flash");
									var playerEntity : PlayerEntity = entities[PlatformGame.PLAYER_INDEX];
									playerEntity.canTakePhotograph = true;	
								} 
								
								if ( isDynamic ) {
									var currentEntity : GameEntity = GameEntity(entities[entityId]);
									currentEntity.clip.removeMovieClip();
									var ball = particleSystem.dynamicBoundingBalls[index];
									var particle = particleSystem.dynamicEntities[index];
									delete(ball);
									delete(particle);
									delete(currentEntity);
									entities[entityId] = null;
									particleSystem.dynamicBoundingBalls[index] = null;
									particleSystem.dynamicEntities[index] = null;
								}
								
								break;
							case Event.MODIFY_POINTS : 
								score += currentEvent.params[0];
								break;
							case Event.MODIFY_GOAL_STATUS : 
							trace ("modify goal status");
								// params[0] == goal index
								// params[1] == true for tick, false for cross
								ePhone.status["button" + ePhone.status.nextButton].gotoAndPlay("tick");
								ePhone.status.nextButton ++;
							
								break;
							case Event.TRIGGER_LEVEL_END :
								gameState = Constants.STATE_LEVEL_COMPLETE;
								break;
							case Event.TRIGGER_GAME_END:
								gameState = Constants.STATE_GAME_OVER;
								break;
							case Event.BE_KILLED:
								// check goals
								for ( var i : Number = 0; i < level.goals.length; i++) { 
									var goal : Goal = level.goals[i];
									newEvents = goal.updateGoal(currentEvent);
								}
								
								// update microbe
								newEvents.concat(currentEvent.target.act(currentEvent));
								
								
								// update points
								var params = new Array();
								if ( currentEvent.target instanceof BadMicrobe ) {
									params.push(5);
											trace("15pts kill bad");	
								} else {
									params.push(-10);
									trace("-10 pts kill good");
								}
								var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
								newEvents.push(pointsEvent);
								break;
							case Event.BE_PHOTOGRAPHED:
								// check goals
								for ( var i : Number = 0; i < level.goals.length; i++) { 
									var goal : Goal = level.goals[i];
									newEvents = goal.updateGoal(currentEvent);
								}
								
								// update microbe
								newEvents.concat(currentEvent.target.act(currentEvent));
								
								
								// update points
								var params = new Array();
								if ( currentEvent.target instanceof GoodMicrobe ) {
									params.push(5);
											trace("5pts photo good");	
								} else {
									params.push(15);
									trace("15pts photo bad");
								}
								var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
								newEvents.push(pointsEvent);
								
								break;
							case Event.MILK_GLASS_EVENT_TURN_TO_YOGURT:
								// check goals
								for ( var i : Number = 0; i < level.goals.length; i++) { 
									var goal : Goal = level.goals[i];
									newEvents = goal.updateGoal(currentEvent);
								}
								
								// update points
								var params = new Array();
								params.push(50);
								var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
								newEvents.push(pointsEvent);
								
								break;
							default : 
								if ( currentEvent.type == Event.BE_HURT ) {
									trace ("execute hurt");
								}
								newEvents = currentEvent.target.act(currentEvent);
								//trace (newEvents.length + " - " + newEvents[0].type);						
								break;
							
						}
						
						//trace ("new events length: " + newEvents.length);
						
						if ( newEvents != null && newEvents.length > 0) {
							entityEvents = entityEvents.concat(newEvents);
							//trace ("added " + newEvents.length + " to entityevents");
						}
					}
					//trace (eventsString);
					
					particleSystem.timeStep();
					
					// if no entities have moved, no need to redraw screen
					for (var i : Number = 0;i < entities.length; i++) {
						var particle : Entity = entities[i].particle;
						if ( !particle.position.equals(particle.previousPosition, 1) ) {
							dirtyScreen = true;
						}
					}

					/*
					 * 	If player's physics entity is near to the screen's edge, scroll.
					 *	Scroll speed affects tiles, not the player - so if the player is moving 
					 *	to the right, the tiles need to move to the left, so scroll speed 
					 *	ends up -ve
					 */
					var playerEntity : GameEntity = GameEntity(entities[PlatformGame.PLAYER_INDEX]);
					if (playerEntity.clip._x + playerEntity.clip._width >= PlatformGame.SCROLL_MARGIN_RIGHT) {
						scrollLeft = false;
						scrollRight = true;
						scrollSpeed = (playerEntity.particle.position.x - playerEntity.particle.previousPosition.x);
						// sanity check - if for some reason player is PAST the scroll boundary, scroll speed may end up negative - resulting in being stuck due to never moving
						// in correct direction
						if (scrollSpeed < 0) {
							scrollSpeed = -1 * scrollSpeed;
						}
						
					} else if (playerEntity.clip._x <= PlatformGame.SCROLL_MARGIN_LEFT) {
						scrollRight = false;
						scrollLeft = true;
						scrollSpeed = -(playerEntity.particle.position.x - playerEntity.particle.previousPosition.x);
						// sanity check - if for some reason player is PAST the scroll boundary, scroll speed may end up negative 
						// resulting in being stuck due to never moving in correct direction
						if (scrollSpeed < 0) {
							scrollSpeed = -1 * scrollSpeed;
						}
					} else {
						scrollRight = scrollLeft = false;
					}
					
					busy = true;
					busy = !updateScore();
					

					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_UPDATE_WORLD] += timePassed;
					break;
				case Constants.STATE_RENDER_WORLD:
					var mainTimeStart : Number = getTimer();

					
					// hack todo - had to change the leftmost column to a few left instead of -1 to allow for large blocks that were never being removed
						
					leftMostColumn = Math.floor(screenTopLeft.xPos / Constants.TILE_WIDTH) - 5;
					rightMostColumn = Math.ceil(screenBottomRight.xPos / Constants.TILE_WIDTH);
					
					if (debug) {
						_root["debugPanel"]["label0"].text = "Photographs";
						_root["debugPanel"]["value0"].text = (level.goals[0].required - level.goals[0].achieved);
						
						_root["debugPanel"]["label1"].text = "Ammo";
						_root["debugPanel"]["value1"].text = PlayerEntity(entities[0]).ammo;
	
						_root["debugPanel"]["label2"].text = "Lives";
						_root["debugPanel"]["value2"].text = PlayerEntity(entities[0]).lives;
						

					}
					for (var currentRow:Number = 0; currentRow < this.level.rows; currentRow++) {
						/*
						 *	For each cell on the screen (and one extra on either side), draw the tile that is placed there.
						 *
						 *	We can tell which tile should be there by looking up the geometry array based on relative
						 *	position + the offset (leftMostColumn)
						 *
						 */
						for (var currentCol:Number = leftMostColumn-1; currentCol <= rightMostColumn+1 ; currentCol++) {
							if ( !isNaN(level.levelDataGeometry[currentRow][currentCol])) {
								var currentCell:MovieClip ;
								/*
								 * Test to see if a movie clip already exists for this cell
								 * note this test against 'row' is wierd but it seems that when you remove the clip, 
								 * it doesn't evaluate as null, void or undefined - it just 'resets' the MC so only 
								 * way to test is to compare against a dynamic field.
								 */
								if (cells[currentRow][currentCol].row == undefined) { 
									if (cells[currentRow] == undefined) {
										cells[currentRow] = new Array();
									}

									// using the identifying number in the level geometry array, clone the base tile
									currentCell = tiles[level.levelDataGeometry[currentRow][currentCol]].duplicateMovieClip("cell"+currentRow+"-"+currentCol, getNextHighestDepth());
									currentCell.row = currentRow;
									currentCell.col = currentCol;
									currentCell.name = tiles[level.levelDataGeometry[currentRow][currentCol]]._name;
									cells[currentRow][currentCol] = currentCell;
									particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = false;
									if (debug) {
										currentCell.createTextField("coordText", currentCell.getNextHighestDepth(), 5, 30, 40, 30);
										var coordText : TextField = currentCell.coordText;
										coordText.htmlText = currentCol + ", " + currentRow;
									}
								} else {
									// there IS a cell at this position so no need to clone a new one.
									currentCell = this.cells[currentRow][currentCol];
								}
								// adjust current cell's position to reflect scrolling
								currentCell._x = currentCol * Constants.TILE_WIDTH - this.screenTopLeft.xPos;
								currentCell._y = currentRow * Constants.TILE_WIDTH + this.screenTopLeft.yPos;
								currentCell._visible = true;

								if (currentCell._x > Constants.SCREEN_WIDTH || (currentCell._x + currentCell._width <= 0)) {
									particleSystem.staticEntities[staticEntities[currentRow][currentCol]].physicsExcempt = true;
									currentCell.removeMovieClip();									
								} 
							}
						}
					}

					// move dynamic entities to be aligned to their physics positions
					for (var i:Number = 0; i < entities.length; i++) {
						var mirroredImageOffset : Number = 0;
						if (entities[i].direction == GameEntity.RIGHT && entities[i].clip._xscale == -100 ) {
							entities[i].clip._xscale = 100;
						} else if (entities[i].direction == GameEntity.LEFT) {
							mirroredImageOffset = entities[i].particle.width;	

							if ( entities[i].clip._xscale == 100 ) {
								entities[i].clip._xscale = -100;	
							}
						}
						entities[i].clip._x = entities[i].particle.position.x - screenTopLeft.xPos + mirroredImageOffset;

						entities[i].clip._y = entities[i].particle.position.y;
						
						// if an entity is offscreen, don't update it.
						if (entities[i].clip._x > Constants.SCREEN_WIDTH || (entities[i].clip._x + entities[i].clip._width <= 0)) {
							entities[i].isOnScreen = false;
							entities[i].particle.physicsExcempt = true;																
						} else {
							entities[i].isOnScreen = true;
							if ( entities[i].state == GameEntity.GAME_ENTITY_STATE_DYNAMIC ||
							entities[i].state == GameEntity.GAME_ENTITY_STATE_FALL ||
							entities[i].state == GameEntity.GAME_ENTITY_STATE_JUMP_MID) {
								entities[i].particle.physicsExcempt = false;
							 }													
						}
					}
					
					
					this.gameState = Constants.STATE_UPDATE_WORLD;
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_RENDER_WORLD] += timePassed;
					break;

				case Constants.STATE_LEVEL_COMPLETE:
				case Constants.STATE_GAME_OVER:
					var mainTimeStart : Number = getTimer();
					/*
					 * 	If there is another level, empty this level of all clips and particles and load in the next one.
					 *	Else, remove everything and jump to close.
					 */
					busy = true;
					busyString = "level transition clean up";

					// clips
					for (var currentRow:Number = 0; currentRow < this.level.rows; currentRow++) {
						// loop cols removing cells
						for (var currentCol:Number = 0; currentCol <= this.rightMostColumn+1; currentCol++) {
							if ( !isNaN(level.levelDataGeometry[currentRow][currentCol])) {
								this["cell"+currentRow+"-"+currentCol].removeMovieClip();
							}
						}
					}
					
					// tile physics particles
					while (particleSystem.staticEntities.length > 0) { 
						delete(particleSystem.staticEntities.pop());
					}
					
					while (particleSystem.staticBoundingBalls.length > 0) {
						delete (particleSystem.staticBoundingBalls.pop());
					}
					
					// phone
					trace ( ePhone.status._width);
					ePhone.status.removeMovieClip()
					
					trace ( ePhone.status._width);
					//ePhone.bigScreen._visible = false;
					

					// entities
					var playerClip : MovieClip = GameEntity(entities[PlatformGame.PLAYER_INDEX]).clip;
					playerClip._xscale = 100;
					
					delete(entities[PlatformGame.PLAYER_INDEX]);
					 
					while ( entities.length > 0 ) {
						var currentEntity : GameEntity = GameEntity(entities.pop());
						currentEntity.clip.removeMovieClip();
						delete (currentEntity);
					}				
					
					// tile physics particles
					while (particleSystem.dynamicEntities.length > 0) { 
						delete(particleSystem.dynamicEntities.pop());
					}
					
					while (particleSystem.dynamicBoundingBalls.length > 0) {
						delete (particleSystem.dynamicBoundingBalls.pop());
					}
					
					
					Key.removeListener(keyListener);
					
					// transition
					if (level.next == "exit") {
						exitReason = END_REASON_COMPLETE;
						gameState = Constants.STATE_GAME_OVER;
						busy = false;
						trace ("no levels after this one so exit hoverboard");
					} 
					
					if ( gameState == Constants.STATE_GAME_OVER) {
						busy = false;
						busyString = "";
						//trace ("Game state is 'game over' so calling root function endofHoverboard()");
						_root.endofHoverboard(exitReason);
					} else {
						trace("Next Level Init");
						this.initialiseGame(player,level.next, mapBuilder.tilesList);
					}
					
					var timePassed = getTimer() - mainTimeStart;
					mainTimes[Constants.STATE_INIT] += timePassed;
					break;
			}
			
		} else trace ("BUSY" + busyString);
	}


	/**
	 * Attach keyboard to the player physics entity
	 */
	function mapControls(playerEntity : PlayerEntity) : Void{
		playerEntity.clip.dir = "right";
		var parent = this;
		keyListener = new Object();
		keyListener.parent = this;
		keyListener.onKeyDown = function() {
			if (Key.getCode() == Key.DOWN) {
				playerEntity.down_down = true;
			}
			if (Key.getCode() == Key.UP) { 
				//trace ("key up pressed");
				playerEntity.up_down = true;	
			}
			if (Key.getCode() == Key.LEFT) {
				playerEntity.left_down = true;	
			}
			if (Key.getCode() == Key.RIGHT) {
				playerEntity.right_down = true;
			}
			if (Key.getCode() == Key.SPACE) {
				playerEntity.fire_down = true;
			}
			
			if (Key.getCode() == Key.CONTROL) {
				playerEntity.alt_fire_down = true;
			}
			
			if (Key.getCode() == Key.HOME || Key.getCode() == Key.ALT) {
				trace("CHEAT: end level");
				this.parent.gameState = Constants.STATE_LEVEL_COMPLETE;
			}
		}
		
		keyListener.onKeyUp = function() {	
			if (Key.getCode() == Key.DOWN) {
				playerEntity.down_up = true;
			} else if (Key.getCode() == Key.UP) {
				playerEntity.up_up = true;	
			} else if (Key.getCode() == Key.LEFT) {
				playerEntity.left_up = true;
			} else if (Key.getCode() == Key.RIGHT) {
				playerEntity.right_up = true;	
			} else if (Key.getCode() == Key.SPACE) {
				playerEntity.fire_up = true;	
			} else if (Key.getCode() == Key.CONTROL) {
				playerEntity.alt_fire_up = true;
			} else {
				trace ("other release " + Key.getCode());	
			}
		};
		Key.addListener(keyListener);
	}

	function isLevelLoaded() : Void {
		var xmlLoaded : Number = this.mapBuilder.xml.getBytesLoaded();
		var xmlTotal : Number = this.mapBuilder.xml.getBytesTotal();
		var percentage:Number = 0;
		if (xmlTotal > 0) {
			percentage = (xmlLoaded / xmlTotal) * 100;
		}
		if (percentage == 100) {
			if ( this.mapBuilder.loading == false ) {
				this.gameState = Constants.STATE_LEVEL_LOADED;
				this.level = this.mapBuilder.level;
			}
			else {
				this.mapBuilder.parseXML();
			}
		}
	}
	
	function updateScore() : Boolean {
		var tempscore : Number = score;
		var thousands : Number = Math.floor(tempscore / 1000);		
		tempscore -= (thousands * 1000);
		var hundreds : Number = Math.floor(tempscore / 100);		
		tempscore -= (hundreds * 100);
		var tens : Number = Math.floor(tempscore / 10);		
		tempscore -= (tens * 10);
		var units = Math.floor(tempscore);
		
		this._parent.score.units.gotoAndPlay(translateNumbersToWords(units));
		this._parent.score.tens.gotoAndPlay(translateNumbersToWords(tens));
		this._parent.score.hundreds.gotoAndPlay(translateNumbersToWords(hundreds));
		this._parent.score.thousands.gotoAndPlay(translateNumbersToWords(thousands));
		return true;
	}
	
	function translateNumbersToWords(number : Number) : String {
		var result : String = "zero";
		
		if (number == 1) {
			result = "one";	
		} else if (number == 2) {
			result = "two";	
		} else if (number == 3) {
			result = "three";	
		} else if (number == 4) {
			result = "four";	
		} else if (number == 5) {
			result = "five";	
		} else if (number == 6) {
			result = "six";	
		} else if (number == 7) {
			result = "seven";	
		} else if (number == 8) {
			result = "eight";	
		} else if (number == 9) {
			result = "nine";	
		}
		
		return result;	
	}


}