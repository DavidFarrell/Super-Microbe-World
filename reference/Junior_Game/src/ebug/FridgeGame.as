/**
 * @author sbbc231
 */

import ebug.*;

class ebug.FridgeGame extends Game{
	var scenarioText:TextField;
	var levelText:TextField;
	var theRoot:MovieClip;
	var currentFrame:String;
	var continueButton:mx.controls.Button;
	var rubbishMC:MovieClip;
	
	//hack!
	var roundTextFinished:Boolean;
	
	// each cell has array with
	//	 [FOOD_NAME]
	//	 [FOOD_TYPE]
	// 	 [INCORRECT_PLACEMENT_REASON]
	var postLevelInfos:Array;
	
	var score:Number;
	var scoreText:TextField;
	
	// each cell of array is an array containing:
	// [FOOD_NAME] - String
	// [FOOD_MC] - MovieClip of food item.
	// [FOOD_TYPE] - shows meat or veg or other
	// [FOOD_INCORRECTLY_PLACED] - is true if the player put it in the wrong place last level
	var food:Array;
	
	// maps food types to valid strings.  index is food type contains an array of strings matching areas
	var validAreas:Array;
	
	/* contains mc clips of areas of fridge (or other area) that user clicks on to place food
	 * Each cell has a scaleFactor that defines how to shrink the food
	 * also have the option of addign a 'transType' and 'transValue' which allow us to do any other tween
	 * each mc has an array called "anchors"
	 * Each cell in anchors is a position within this area for food.
	 * inside each anchor there is:
	 *		item:boolean which specifies occupancy
	 * 		xPos and yPos
	 */ 
	var fridgeAreas:Array;
	
	// each cell of array is a two cell array containing:
	// [FOOD] - containing an array that follows the same structure as the 'food' array below
	// [CORRECTLY_PLACED] - boolean.
	var placedObjects:Array;
	
	var ticksAndCrosses:Array;
	
	var currentFoodItem:Array;
	var movingFood:Array;
	
	// when a new bit of food appears, flash the name up
	var fadingFoodText:Array;
	
	// true between placing an item and exposing next one
	var newItem:Boolean;
	
	var purpleTextBold:TextFormat;
	var purpleTextSkinny:TextFormat;
	var useBold:Boolean;
	var timeLeft:Number;
	var timeLeftText:TextField;
	
	var level:Number;
	var levels:Array;
	var timerInterval:Number;
	
	var foodTypes:Array;
	
	// food types to be put in above array;
	var cheese:Array;
	var chicken:Array;
	var cucumber:Array;
	var lettuce:Array;
	var sausages:Array;
	var springOnion:Array;
	var cat:Array;
	var ball:Array;
	var bird:Array;
	var soup:Array;
	
	public static var FOOD_NAME:Number = 0;
	public static var FOOD_MC:Number = 1;
	public static var FOOD_TYPE:Number = 2;
	public static var FOOD_INCORRECTLY_PLACED:Number = 4;
	
	public static var FOOD:Number = 5;
	public static var CORRECTLY_PLACED:Number = 6;
	
	public static var FOOD_TYPE_MEAT:Number = 7;
	public static var FOOD_TYPE_VEG:Number = 8;
	public static var FOOD_TYPE_ANIMAL:Number = 9;
	public static var FOOD_TYPE_DAIRY:Number = 10;
	public static var FOOD_TYPE_TIN:Number = 11;
	public static var FOOD_TYPE_TOY:Number = 12;
	public static var FOOD_TYPE_OTHER:Number = 13;
	
	public static var INCORRECT_PLACEMENT_REASON:Number = 14;
	public static var INCORRECT_PLACEMENT_REASON_AREA:Number = 15;
	public static var INCORRECT_PLACEMENT_REASON_AMIMAL:Number = 16;
	public static var INCORRECT_PLACEMENT_REASON_TIN:Number = 17;
	public static var INCORRECT_PLACEMENT_REASON_TOY:Number = 18;
	public static var INCORRECT_PLACEMENT_REASON_OTHER:Number = 19;
	public static var INCORRECT_PLACEMENT_REASON_PROXIMITY:Number = 20;
	
	
	public function init() {
		this.fridgeAreas = new Array();
		this.placedObjects = new Array();
		this.theRoot = _root;
		
		this.level = 0;
		this.score = 0;
		this.food = new Array();
		this.movingFood = new Array();
		this.newItem = true;
		this.ticksAndCrosses = new Array();
		this.fadingFoodText = new Array();
		this.postLevelInfos = new Array();
		
		this.purpleTextBold = new TextFormat();
		purpleTextBold.color = 0x7A0CFF;
		purpleTextBold.font = "arial_bold";
		purpleTextBold.size = 32;
		purpleTextBold.bold = true;
		purpleTextBold.italic = false;
	
		this.purpleTextSkinny = new TextFormat();
		purpleTextSkinny.color = 0xFF7E0C;
		purpleTextSkinny.font = "arial";
		purpleTextSkinny.size = 32;
		purpleTextSkinny.bold = true;
		purpleTextSkinny.italic = false;
		
		useBold = true;
		
		this.foodTypes = new Array();
		this.foodTypes.push("cheese");
		this.foodTypes.push("chicken");
		this.foodTypes.push("cucumber");
		this.foodTypes.push("lettuce");
		this.foodTypes.push("sausages");
		this.foodTypes.push("springOnion");
		this.foodTypes.push("cat");
		this.foodTypes.push("ball");
		this.foodTypes.push("bird");
		this.foodTypes.push("soup");
		
		// initialise food types
		this.cheese = new Array();
		cheese[FOOD_NAME] = "cheese";
		cheese[FOOD_MC] = this.attachMovie("cheese", "cheese", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		cheese[FOOD_TYPE] = FOOD_TYPE_DAIRY;
				
		this.chicken = new Array();
		chicken[FOOD_NAME] = "chicken";
		chicken[FOOD_MC] = this.attachMovie("chicken", "chicken", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		chicken[FOOD_TYPE] =  FOOD_TYPE_MEAT;
				
		this.cucumber = new Array();
		cucumber[FOOD_NAME] = "cucumber";
		cucumber[FOOD_MC] = this.attachMovie("cucumber", "cucumber", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		cucumber[FOOD_TYPE] = FOOD_TYPE_VEG
		
		this.lettuce = new Array();
		lettuce[FOOD_NAME] = "lettuce";
		lettuce[FOOD_MC] = this.attachMovie("lettuce", "lettuce", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		lettuce[FOOD_TYPE] = FOOD_TYPE_VEG;
		
		this.sausages = new Array();
		sausages[FOOD_NAME] = "sausages";
		sausages[FOOD_MC] = this.attachMovie("sausages", "sausages", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		sausages[FOOD_TYPE] = FOOD_TYPE_MEAT ;
		
		this.springOnion = new Array();
		springOnion[FOOD_NAME] = "spring onions";
		springOnion[FOOD_MC] = this.attachMovie("springonion", "springOnion", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		springOnion[FOOD_TYPE] = FOOD_TYPE_VEG;
		
		this.cat = new Array();
		cat[FOOD_NAME] = "cat";
		cat[FOOD_MC] = this.attachMovie("cat", "cat", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		cat[FOOD_TYPE] = FOOD_TYPE_ANIMAL;
		
		this.ball = new Array();
		ball[FOOD_NAME] = "ball";
		ball[FOOD_MC] = this.attachMovie("ball", "ball", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		ball[FOOD_TYPE] = FOOD_TYPE_TOY;
		
		this.bird = new Array();
		bird[FOOD_NAME] = "bird";
		bird[FOOD_MC] = this.attachMovie("bird", "bird", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		bird[FOOD_TYPE] = FOOD_TYPE_ANIMAL;
		
		this.soup = new Array();
		soup[FOOD_NAME] = "soup";
		soup[FOOD_MC] = this.attachMovie("soup", "soup", this.getNextHighestDepth(), {_x:250, _y:320, _visible:false});
		soup[FOOD_TYPE] = FOOD_TYPE_TIN;
		
		/*
		 *	Define valid areas
		 */
		this.validAreas = new Array();
		
		this.validAreas[FOOD_TYPE_ANIMAL] = new Array();
		this.validAreas[FOOD_TYPE_ANIMAL].push("bin1");
		
		this.validAreas[FOOD_TYPE_DAIRY] = new Array();
		this.validAreas[FOOD_TYPE_DAIRY].push("shelf4");
		this.validAreas[FOOD_TYPE_DAIRY].push("shelf3");
		this.validAreas[FOOD_TYPE_DAIRY].push("shelf2");
		this.validAreas[FOOD_TYPE_DAIRY].push("shelf1");
		this.validAreas[FOOD_TYPE_DAIRY].push("drawer1");
		this.validAreas[FOOD_TYPE_DAIRY].push("drawer2");
		this.validAreas[FOOD_TYPE_DAIRY].push("drawer3");
		this.validAreas[FOOD_TYPE_DAIRY].push("door1");
		this.validAreas[FOOD_TYPE_DAIRY].push("door2");
		this.validAreas[FOOD_TYPE_DAIRY].push("door3");
		
		this.validAreas[FOOD_TYPE_VEG] = new Array();
		this.validAreas[FOOD_TYPE_VEG].push("shelf4");
		this.validAreas[FOOD_TYPE_VEG].push("shelf3");
		this.validAreas[FOOD_TYPE_VEG].push("shelf2");
		this.validAreas[FOOD_TYPE_VEG].push("shelf1");
		this.validAreas[FOOD_TYPE_VEG].push("drawer1");
		this.validAreas[FOOD_TYPE_VEG].push("drawer2");
		this.validAreas[FOOD_TYPE_VEG].push("drawer3");
		this.validAreas[FOOD_TYPE_VEG].push("door1");
		this.validAreas[FOOD_TYPE_VEG].push("door2");
		this.validAreas[FOOD_TYPE_VEG].push("door3");
		
		this.validAreas[FOOD_TYPE_MEAT] = new Array();
		this.validAreas[FOOD_TYPE_MEAT].push("shelf1");
		this.validAreas[FOOD_TYPE_MEAT].push("drawer1");
		this.validAreas[FOOD_TYPE_MEAT].push("drawer2");
		this.validAreas[FOOD_TYPE_MEAT].push("drawer3");
		
		this.validAreas[FOOD_TYPE_OTHER] = new Array();
		this.validAreas[FOOD_TYPE_OTHER].push("bin1");
		
		this.validAreas[FOOD_TYPE_TOY] = new Array();
		this.validAreas[FOOD_TYPE_TOY].push("bin1");
		
		this.validAreas[FOOD_TYPE_TIN] = new Array();
		this.validAreas[FOOD_TYPE_TIN].push("cupboard1");
		
		/* 
		 * Define Levels
		 */
		 this.levels = new Array();
		 this.levels.push({items:10,time:60});
		 this.levels.push({items:15,time:45});
		 this.levels.push({items:20,time:30});
		     
		
		this.gameState = Constants.STATE_INIT;
		super.init();
	}
	
	public function getLevelText():String {
		var text = "This bag has " + this.levels[this.level].items + " items.";
		switch(this.level) {
			case 0:
				text += "\nRemember, meat goes in the bottom drawers and watch out for my cat, I can't find him!";
				break;
			case 1:
				text += "\nIt's always a good idea to keep meat away from vegetables in your fridge.";
				break;
			case 2:
				text += "\nHas anyone seen my pet Golden Eagle?";
				break;
			case 3:
				text += "\nRemember, meat goes in the bottom drawers and watch out for my cat, I can't find him!";
				break;
			case 4:
				text += "\nRemember, meat goes in the bottom drawers and watch out for my cat, I can't find him!";
				break;
		}
		return 	text;
	}
	
	public function getAllCorrectText() {
		return "Excellent! You put everything in the correct place.";	
	}
	
	public function getReasonText(type:Number, reason:Number, name:String, location:String):String {
		var text = "";
		
		switch(reason) {
			case FridgeGame.INCORRECT_PLACEMENT_REASON_AREA:
				text += "You put " + name + " in " + location +".";
				switch (type) {
					case FOOD_TYPE_MEAT:
						text += "\nMeat should be put on a solid, low down, shelf or in a drawer";
						break;
					case FOOD_TYPE_ANIMAL:
						text += "\nAnimals shouldn't be stored like that!";
						break;
					case FOOD_TYPE_DAIRY:
						text += "\nDairy products, like milk and cheese should be kept in the fridge";
						break;
					case FOOD_TYPE_TIN:
						text += "\nTinned foods are usually fine being stored in cupboards";
						break;
					case FOOD_TYPE_TOY:
						text += "\nToys don't go there!";
						break;
					case FOOD_TYPE_VEG:
						text += "\nVegetables last much longer if you store them in the fridge.";
						break;
				}
				break;
			case FridgeGame.INCORRECT_PLACEMENT_REASON_PROXIMITY:
				text += "You put meat and veg together";
				break;
			case FridgeGame.INCORRECT_PLACEMENT_REASON_AMIMAL:
				text += "You can't put an animal in there!";
				break;
		}
		return 	text;
	}
	
	public function getScenarioText():String {
		if (this.gameState == Constants.STATE_TRIGGER_WIN) {
			return "Yay! We managed to get all the shopping put away in time for the show.";
		} else if (this.gameState == Constants.STATE_TRIGGER_LOSE) {
			return "Boo! We didn't finish in time.  Maybe we can try again?";
		} else {
			return 	"Hi!\nI only have " + this.levels[this.level].time + " seconds to put away the shopping before we have to go back to the show.  Can you help me?";
		}
	}
	
	public function main() {
		switch (this.gameState) {
			case Constants.STATE_INIT:
				this.gameState = Constants.STATE_INIT_DIALOGUE;
				this.theRoot.gotoAndPlay("dialogue");
				break;
			case Constants.STATE_INIT_DIALOGUE:
				this.levelText.text = getLevelText();
				this.scenarioText.text = getScenarioText();
				this.continueButton.addEventListener("click", this);
				break;
			case Constants.STATE_CREATE_GUI:
				// link area buttons to function
				for (var i:Number = 0; i < this.fridgeAreas.length; i++) {
					this.fridgeAreas[i]._alpha = 0;
					this.fridgeAreas[i].onRollOver = function() {
						this._alpha = 20;
					};
					this.fridgeAreas[i].onRollOut = function() {
						this._alpha = 0;
					};
					this.fridgeAreas[i].onReleaseOutside = this.fridgeAreas[i].onRollOut;
					
					this.fridgeAreas[i].onPress = this.moveFoodFromTable;
					this.fridgeAreas[i].theParent = this;
				}	
				
				this.createTextField("timeLeftText", this.getNextHighestDepth(), 700, 5, 50, 50);
				this.timeLeftText.setNewTextFormat(purpleTextBold);
				this.timeLeftText.htmlText = "" +timeLeft;
			
				this.createTextField("scoreText", this.getNextHighestDepth(), 720, 40, 50,50);
				this.scoreText.setNewTextFormat(purpleTextBold);
				this.scoreText.htmlText = "" + score;
				
				this.gameState = Constants.STATE_ROUND_TEXT;
				break;
			case Constants.STATE_LOAD_LEVEL:
				this.food = new Array();
				this.timeLeft = this.levels[this.level]["time"];
				
				var min:Number = 0;
				var max:Number = this.foodTypes.length - 1;
				
				for (var i:Number = 0; i < this.levels[this.level]["items"]; i++) {
					var index:Number = Math.floor(Math.random() * (max - min + 1)) + min ;
					var oldFood = this[this.foodTypes[index]];
					var newFood:Array = new Array();
					
					newFood[FOOD_NAME] = oldFood[FOOD_NAME];
					newFood[FOOD_MC] = oldFood[FOOD_MC].duplicateMovieClip(newFood[FOOD_NAME] + i, this.getNextHighestDepth(), { _visible:false});
					newFood[FOOD_TYPE] = oldFood[FOOD_TYPE];
					this.food.push(newFood)	;
				}
				this.gameState = Constants.STATE_CREATE_GUI;
				break;
			case Constants.STATE_ROUND_TEXT:
				if (this.roundTextFinished == true) {
					this.roundTextFinished = false;
					this.gameState = Constants.STATE_UPDATE_WORLD;
					this.timerInterval = setInterval(this, "timer", 1000);
				} 
				break;
			case Constants.STATE_UPDATE_WORLD: 
				this.gameState = Constants.STATE_RENDER_WORLD;
				if (this.newItem) {
					// if there are items left
					if (this.placedObjects.length != this.food.length) {
						this.currentFoodItem = this.food[this.placedObjects.length];
						this.currentFoodItem[FOOD_MC]._visible = true;
						
						var textAid:TextField = TextField(this.createTextField("fadeTextMC" + this.placedObjects.length, this.getNextHighestDepth(), 200, 225, 200, 50));
						textAid.embedFonts = true;
						textAid.setNewTextFormat(this.purpleTextSkinny);
						textAid.htmlText = this.currentFoodItem[FOOD_NAME];
						textAid["xMove"] = Math.floor(Math.random() * (25 - -25 + 1)) + -20 ;
						this.fadingFoodText.push(textAid);
					}
					this.newItem = false;
				}
				
				// move food to and from the fridge
				for (var i:Number = 0; i < this.movingFood.length; i++) {
					var tempFood:MovieClip = this.movingFood[i];
					var factor = 2;
					
					// tween position
					var distX:Number = Math.round( (tempFood["destX"] - tempFood._x)/ factor   );
					var distY:Number = Math.round((tempFood["destY"] - tempFood._y)/ factor );
					tempFood._x += distX ;
					tempFood._y += distY;
					if ( Math.abs(tempFood._x - tempFood["destX"]) < 2  ) {
						tempFood._x = tempFood["destX"];	
					}
					if ( Math.abs(tempFood._y - tempFood["destY"]) < 2  ) {
						tempFood._y = tempFood["destY"];	
					}
					
					// tween scale
					var scaleChange:Number = Math.round( (tempFood["destScale"] - tempFood._xscale)/ factor   );
					tempFood._xscale += scaleChange ;
					tempFood._yscale += scaleChange;
					
					if ( Math.abs(tempFood._xscale - tempFood["destScale"]) < 2 ) {
						tempFood._xscale = tempFood["destScale"];
					}
					
					if ( Math.abs(tempFood._yscale - tempFood["destScale"]) < 2 ) {
						tempFood._yscale = tempFood["destScale"];
					}
					
					// tween the 'optional' transform
					var transChange:Number = Math.round( (tempFood["transValue"] - tempFood[tempFood["transType"]])/ factor   );
					tempFood[tempFood["transType"]] += transChange;
					
					if ( Math.abs(tempFood["transValue"] - tempFood[tempFood["transType"]]) < 2 ) {
						tempFood[tempFood["transType"]] = tempFood["transValue"];
					}
				
					// test to see if all tweens are done
					if (tempFood._x == tempFood["destX"] && tempFood._y == tempFood["destY"] &&
						tempFood._xscale == tempFood["destScale"] && tempFood._yscale == tempFood["destScale"]) {
					
						// reached destination so stop moving
						movingFood.shift();
						i--;
						
						// test for all objects having been placed
						if (this.placedObjects.length == this.food.length && this.movingFood.length == 0) {
							this.level++;
							
							// visually hide all mcs
							for (var j:Number = 0; j < this.placedObjects.length; j++) {
								this.placedObjects[j][FOOD][FOOD_MC]._visible = false;
								this.ticksAndCrosses[j]._visible = false;
							}
							this.timeLeftText._visible = false;
							
							this.theRoot.gotoAndPlay("level_end");
							this.gameState = Constants.STATE_LEVEL_SUMMARY;
							this.dirtyScreen = true;
							break;	
						} 
					} 
					this.dirtyScreen = true;
				}
				
				// make the food text that appears when you place fade away
				for (var i:Number = 0; i < this.fadingFoodText.length; i++) {
					var foodText:TextField = this.fadingFoodText[i];
					foodText._y -= 15;
					foodText._x += foodText["xMove"];
					foodText._alpha -= 10;
					if (foodText["xMove"] < 0) {
						foodText._rotation -= 10;
					} else {
						foodText._rotation += 10;
					}
					if (foodText._alpha <= 0) {
						foodText = TextField(this.fadingFoodText.shift());
						foodText.removeTextField();
					}
				}
				
				// draw ticks and crosses
				var tickXStart:Number = 20;
				var tickYStart:Number = 20;
				var tickDistance:Number = 40;
				
				for (var i:Number = 0; i < this.placedObjects.length; i++) {
					if (this.placedObjects[i][CORRECTLY_PLACED]) {
						if (this.ticksAndCrosses[i].tick == false) {
							this.ticksAndCrosses[i].removeMovieClip();
							this.ticksAndCrosses[i] = this.attachMovie("tick", "tickOrCrossMC" + i, this.getNextHighestDepth(), {_x:(tickDistance*i)+tickXStart, _y:tickYStart });
							this.ticksAndCrosses[i].tick = true;
						} else if (this.ticksAndCrosses[i].tick == undefined) {
							this.ticksAndCrosses[i] = this.attachMovie("tick", "tickOrCrossMC" + i, this.getNextHighestDepth(), {_x:(tickDistance*i)+tickXStart, _y:tickYStart });
							this.ticksAndCrosses[i].tick = true;
						}
					} else {
						if (this.ticksAndCrosses[i].tick == true) {
							this.ticksAndCrosses[i].removeMovieClip();
							this.ticksAndCrosses[i] = this.attachMovie("cross", "tickOrCrossMC" + i, this.getNextHighestDepth(), {_x:(tickDistance*i)+tickXStart, _y:tickYStart });
							this.ticksAndCrosses[i].tick = false;
						} else if (this.ticksAndCrosses[i].tick == undefined) {
							this.ticksAndCrosses[i] = this.attachMovie("cross", "tickOrCrossMC" + i, this.getNextHighestDepth(), {_x:(tickDistance*i)+tickXStart, _y:tickYStart });
							this.ticksAndCrosses[i].tick = false;
						}
					}
				}
				
				break;
			case Constants.STATE_RENDER_WORLD:
				if (this.dirtyScreen == true) {
					this.timeLeftText.htmlText = "" + this.timeLeft;
					this.scoreText.htmlText = "" + this.score;
					
					this.dirtyScreen = false;
				}
				this.gameState = Constants.STATE_UPDATE_WORLD;
				break;
			case Constants.STATE_LEVEL_SUMMARY:
				// dumb code - just testing if this is first call whilst in this state
				if (this.theRoot.scenario_text._visible == false) {
					this.scoreText._visible = false;
					// is true when no more mistakes to show
					if (!this.getNextPostLevelInfo()) {
						if (this.level < this.levels.length) {
							this.scenarioText.text = getAllCorrectText();
						} else  {
							this.scenarioText.text = getAllCorrectText();
						}
					}	
					this.scenarioText._visible = true;
				} 
				break;
			case Constants.STATE_LEVEL_COMPLETE:
				// need to clean up
				cleanUp();
				if (this.level >= this.levels.length) {
					this.gameState = Constants.STATE_TRIGGER_WIN;	
				} else {
					this.gameState = Constants.STATE_INIT_DIALOGUE;
				}
				break;
			case Constants.STATE_TRIGGER_WIN: 
				this.theRoot.gotoAndPlay("you_win");
				this.scenarioText.text = getScenarioText();
				this.continueButton.addEventListener("click", this);
				this.gameState = Constants.STATE_CLOSE;
				break;
			case Constants.STATE_TRIGGER_LOSE: 
				cleanUp();
				this.theRoot.gotoAndPlay("you_lose");
				this.scenarioText.text = getScenarioText();
				this.continueButton.addEventListener("click", this);
				this.gameState = Constants.STATE_CLOSE;
				break;
			case Constants.STATE_CLOSE: 
				this.continueButton.addEventListener("click", this);
				break;
		}	
	}
	
	public function cleanUp():Void {
		// remove food
		var itemsToDelete:Number = this.food.length;
		for (var i:Number = 0; i < itemsToDelete; i++) {
			this.food[0][FOOD_MC].removeMovieClip();
			delete this.food.shift();
		}
		
		// reset placed objects
		itemsToDelete = this.placedObjects.length;
		for (var i:Number = 0; i < itemsToDelete; i++) {
			delete this.placedObjects.shift();
		}
		
		// reset ticks
		itemsToDelete = this.ticksAndCrosses.length;
		for (var i:Number = 0; i < itemsToDelete; i++) {
			this.ticksAndCrosses.shift().removeMovieClip();
		}
		
		this.timeLeftText.removeTextField();
		this.scoreText.removeTextField();
		this.dirtyScreen = true;
		clearInterval(this.timerInterval);
		this.newItem = true;
	}
	
	/*
	 * Moves food from table to fridge - triggered on press of hotspot
	 * It is called as the onPress of the button so this["theParent"] refers to the FridgeGame object
	 */
	public function moveFoodFromTable() {
		if ( this["theParent"].currentFoodItem != null) {
			// check if room
			var emptySlot:Boolean = false;
			var destX:Number;
			var destY:Number;
			var scaleFactor:Number;
			var transType:String;
			var transValue:Number;
			
			// free space?
			for (var i:Number = 0; i < this["anchors"].length && !emptySlot; i++) {
				if (this["anchors"][i]["item"] == false) {
					this["anchors"][i]["item"] = true;
					emptySlot = true;
					this["itemsPlaced"].push(this["theParent"].currentFoodItem);
					
					// it fits here, so pass on spacing details so we can animate the transfer
					destX = this["anchors"][i]["xPos"];
					destY = this["anchors"][i]["yPos"];
					scaleFactor = this["scaleFactor"];
					transType = this["transType"];
					transValue = this["transValue"];
					
					// is bin full?
					if (this._name == "bin1" && (i+1) == this["anchors"].length) {
						this["theParent"].rubbishMC._visible = true;
						this._visible = false;	
					}
				}
			}
			if (emptySlot) {
				var validArea:Boolean = false;
				var reason:Number = INCORRECT_PLACEMENT_REASON_AREA;
				var nextArraySlot:Number = this["theParent"].placedObjects.length;
				
				this["theParent"].currentFoodItem[FOOD_MC].destX = destX;
				this["theParent"].currentFoodItem[FOOD_MC].destY = destY;
				this["theParent"].currentFoodItem[FOOD_MC].destScale = scaleFactor;
				this["theParent"].currentFoodItem[FOOD_MC].transType = transType;
				this["theParent"].currentFoodItem[FOOD_MC].transValue = transValue;
				
				this["theParent"].placedObjects[nextArraySlot] = new Array();
				this["theParent"].placedObjects[nextArraySlot][FOOD] = this["theParent"].currentFoodItem;
				
				
				
				// is it valid? Needs to satisfy shelving and proximity rules
				// first shelving
				for (var i:Number = 0; i < this["theParent"].validAreas[this["theParent"].currentFoodItem[FOOD_TYPE]].length; i++) {
					if ( this["theParent"].validAreas[this["theParent"].currentFoodItem[FOOD_TYPE]][i] == this._name) {
						validArea = true;
					}
				}
				// now proximity (only test if on a valid shelf)
				if (validArea) {
					var newType:Number = this["theParent"].currentFoodItem[FOOD_TYPE];
					for (var i:Number = 0; i < this["itemsPlaced"].length; i++) {
						var existingType:Number = this["itemsPlaced"][i][FOOD_TYPE];
						if ( (existingType == FOOD_TYPE_MEAT && newType == FOOD_TYPE_VEG) || (existingType == FOOD_TYPE_VEG && newType == FOOD_TYPE_MEAT)) {
							reason = INCORRECT_PLACEMENT_REASON_PROXIMITY;
							validArea = false;
						}
					}
				}

				this["theParent"].placedObjects[nextArraySlot][CORRECTLY_PLACED] = validArea;
				
				
				if (!validArea) {
					var alreadyMade:Boolean = false;
					for (var j:Number = 0; j < this["theParent"].postLevelInfos.length && !alreadyMade; j++) {
						if ( this["theParent"].postLevelInfos[j][FOOD_NAME] == this["theParent"].currentFoodItem[FOOD_NAME] ) {
							alreadyMade = true;	
						}
					}
					if (!alreadyMade) {
						var infos:Array = new Array();
						infos[FOOD_NAME] = this["theParent"].currentFoodItem[FOOD_NAME];
						infos[FOOD_TYPE] = this["theParent"].currentFoodItem[FOOD_TYPE];
						infos[INCORRECT_PLACEMENT_REASON_AREA] = this["fullname"];
						infos[INCORRECT_PLACEMENT_REASON] = reason;
						
						this["theParent"].postLevelInfos.push(infos);;
					}
				} else {
					this["theParent"].score++;	
				}
				
				this["theParent"].newItem = true;
				this["theParent"].movingFood.push(this["theParent"].currentFoodItem[FOOD_MC]);
				this["theParent"].currentFoodItem = null;
			}
		}
	}
						
	public function click(sender:Object) {
		if(sender.target._name == "continue_button")	 {
			if (this.gameState == Constants.STATE_LEVEL_SUMMARY) {
				if (!this.getNextPostLevelInfo()) {
					if (this.level < this.levels.length) {
						this.theRoot.gotoAndPlay("next_level");
					}
					this.gameState = Constants.STATE_LEVEL_COMPLETE;
				}
			} else if (this.gameState == Constants.STATE_CLOSE) {
				this.init();
				this.gameState = Constants.STATE_INIT;
			}			
			else {
				this.gameState = Constants.STATE_LOAD_LEVEL;
				this.theRoot.gotoAndPlay("kitchen");
			}
		}
	}
	
	// returns true when it DOES find info, false when it doesn't
	public function getNextPostLevelInfo():Boolean {
		if (this.postLevelInfos.length > 0) {
			var info:Array = Array(this.postLevelInfos.shift())[0];
			this.scenarioText.text = getReasonText(info[FOOD_TYPE], info[INCORRECT_PLACEMENT_REASON], info[FOOD_NAME], info[INCORRECT_PLACEMENT_REASON_AREA]) ;
			return true;
		} else return false;
	}
	
	public function timer() { 
		this.timeLeft--; 
		this.dirtyScreen = true;
		if (this.timeLeft <= 5) {
			if (this.useBold) {
				this.timeLeftText.setNewTextFormat(this.purpleTextBold)	;
				this.useBold = false;
			} else {
				this.timeLeftText.setNewTextFormat(this.purpleTextSkinny)	;
				this.useBold = true;
			}
		}
		
		if (this.timeLeft == -1) {
			this.timeLeft = 0;
			clearInterval(this.timerInterval);
			this.gameState = Constants.STATE_TRIGGER_LOSE;
		}
	}
}