import ebug.*;
import ebug.junior.*;
import ebug.general.*;
import ebug.junior.fridge.FoodItem;
import ebug.util.AssetLibrary;
import ebug.util.GeneralFunctions;
import flash.display.BitmapData;
import flash.filters.DropShadowFilter;

class ebug.junior.fridge.KitchenGame {
	// top level
	var theRoot : MovieClip;
	// where this program draws assets
	var theStage : MovieClip;
	var clock : TextField;
	
	// different intro for each level
	var intros : Array;
	var outro : MovieClip;
	var outroStrings : Array;
	// main game asset
	var theGame : MovieClip;
	
	// convenient clips
	var foodThrowArea : MovieClip;
	var foodContainer : MovieClip;
	var avatar : MovieClip;
	
	var assetLibrary : AssetLibrary
	
	var restingPoints : Array ;
	
	var allPossibleFood : Array;
	var foodFruit : Array;
	var foodVegetables : Array;
	var foodCupboard : Array;
	var foodRawMeat : Array;
	var foodCookedMeat : Array;
	var foodDoor : Array;
	var foodCheese: Array;
	
	var validLocations : Array;
	var remindedFruit : Boolean;
	var remindedVeg : Boolean;
	var remindedCheese : Boolean ;
	var remindedRawMeat : Boolean;
	var remindedCookedMeat : Boolean;
	var remindedLiquids : Boolean ;
	var remindedCupboardItems : Boolean;
		
	
	
	var levelFood : Array;
	var currentFoodItemId : Number
	var currentFoodItem : FoodItem;
	var handStates : Array;
	
	/*
	 * levelScores has the following structure
	 * [foodType]["correct"] = number
	 * [foodType]["incorrect"] = number
	 */
	var levelScores : Array;
	var levelAdmonishments : Array;
	var overallScore : Number;
	
	// cellId is the location - it contains actual food items
	var levelFoodChoices : Array;
	
	var levelSneezes : Boolean;
	var sneezeChance : Number;
	var sneezeTimer : Number;
	
	var removeBinItemTimer : Number;
	
	var level : Number;
	var timeLeft : Number;
	var timer : Number;
	var interval : Number;
	
	var strings : Array;
	
	var locations : Array;
	
	var gameState : Number
	public static var STATE_PICK_ITEM : Number 			= 0;
	public static var STATE_WAIT : Number 				= 1;
	public static var STATE_THROW : Number 				= 2;
	public static var STATE_STORE_FOOD : Number 		= 3;
	public static var STATE_SNEEZE_START : Number 		= 4;
	public static var STATE_SNEEZE_FOOD : Number 		= 5;
	public static var STATE_SNEEZE_TISSUE : Number 		= 6;
	public static var STATE_WASH_HANDS : Number 		= 7;
	public static var STATE_END_OF_LEVEL : Number 		= 8;
	public static var STATE_CLEANUP : Number 			= 9;
	
	public static var LOCATION_TYPE_CUPBOARD 		: Number = 0;
	public static var LOCATION_TYPE_BOWL		 	: Number = 1;
	public static var LOCATION_TYPE_FRIDGE_UPPER	: Number = 2;
	public static var LOCATION_TYPE_FRIDGE_MID		: Number = 3;
	public static var LOCATION_TYPE_FRIDGE_LOWER	: Number = 4;
	public static var LOCATION_TYPE_FRIDGE_DRAWER	: Number = 5;
	public static var LOCATION_TYPE_FRIDGE_DOOR		: Number = 6;
	public static var LOCATION_TYPE_BIN				: Number = 7;
	
	
	var player : Player;
	
	function KitchenGame(theRoot : MovieClip, theStage : MovieClip, player : Player) {
		this.theRoot  = theRoot;
		this.theStage = theStage;
		assetLibrary = new AssetLibrary(theRoot, theStage, "", theRoot["loader"], theStage, "Loading");
		this.player = player;
		validLocations = new Array();
		outroStrings = new Array();
		overallScore = 0;
	}
	
	function init() {
		var assetList : Array = new Array();
		assetList.push("kitchen_game_main.swf");
		assetList.push("kitchen_game_intro_level_0.swf");
		assetList.push("kitchen_game_intro_level_1.swf");
		assetList.push("kitchen_game_intro_level_2.swf");
		assetList.push("kitchen_game_intro_level_3.swf");
		assetList.push("kitchen_game_outro.swf");
		
		intros = new Array();
		strings = new Array();
		locations = new Array();;
		
		populateFoodList();
		populateValidLocations();
		populateOutroStrings();
		
		levelFood = new Array();
		currentFoodItemId = 0;
		level = 0;
		timeLeft = 60;
		
		assetLibrary.loadAssets(this, "assetsLoaded", assetList);
	}
	
	function main() : Void {
		if ( getTimer() - timer > 1000 ) {
			timeLeft--;
			timer = getTimer();
			if ( timeLeft < 0 ) {
				timeLeft = 0;
				gameState = STATE_END_OF_LEVEL;
				timeLeft = 99;
			} else {
				// should we sneeze?
				if ( gameState == STATE_WAIT ) {
					var sneeze : Number = GeneralFunctions.getRandom(0, 10);
					//trace (sneeze + " and " + sneezeChance);
					if ( sneeze > sneezeChance ) {
						startSneeze();
						sneezeChance++;
					}
				} else if ( gameState == STATE_WASH_HANDS ) {
					if ( avatar.midAnimation == false ) {
						handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = false;
						handStates[FoodItem.FOOD_STATE_MEAT_MICROBES] = false;
						
						gameState = STATE_WAIT;
					}
				} else if ( gameState == STATE_END_OF_LEVEL ) {
					// fade main screen and show outro
					clearInterval(interval);
					calculateScores();
					theGame._visible = false;
					
					showOutroAchievements();
					
					
				}
			}
		}
		clock.htmlText = "<font face=\"verdana\"><b>"+timeLeft+"</b></face>";
		
		switch ( gameState ) {
			case STATE_PICK_ITEM :
				pickItem();
				break;
			case STATE_WAIT : 
				// wait for user input
				
				break;
		}
	}
	
	function showOutroAchievements() {
		outro.gotoAndPlay("achievements");
		outro.click_button.callObj = this;
		outro.click_button.callFunc = "showOutroMissed";
		outro.click_button.onRelease = function() {
			var callback : Object = this["callObj"];
			var callFunc : String = this["callFunc"];
			callback[callFunc]();
		}
		outro.text0.text = outroStrings["Shopping Placed Correctly"];
		
		/*
		 * 	outroStrings["Shopping Placed Correctly"] = "Shopping Placed Correctly";
		outroStrings["Fruit"] = "Fruit";
		outroStrings["Vegetables"] = "Vegetables";
		outroStrings["Cupboard Items"] = "Cupboard Items";
		outroStrings["Cheese"] = "Cheese";
		outroStrings["Raw Meat"] = "Raw Meat";
		outroStrings["Cooked Meat"] = "Cooked Meat";
		outroStrings["Points Awarded"] = "Points Awarded";
		outroStrings["Items Placed Incorrectly"] = "Items Placed Incorrectly";
		outroStrings["Microbial Mistakes"] = "Microbial Mistakes";
		outroStrings["Points Deducted"] = "Points Deducted";
		outroStrings["Total Points"] = "Total Points";
		outroStrings["Clingfilm"] = "Raw and Cooked meat should be covered before putting away.";
		outroStrings["Sneeze"] = "If you don't cover your mouth when you sneeze, you can spread harmful microbes.";
		outroStrings["Sneeze Hands"] = "Even if you use a tissue when you sneeze, you should wash your hands before handling food.";
		outroStrings["Bad Food"] = "If food is mouldy or off, you should throw it away.";
		outroStrings["Burst Container"] = "If a liquid container is burst you should throw it away.";
		outroStrings["Cooked Meat Shelf"] = "Cooked meat should be covered and placed on its own shelf.";
		outroStrings["Raw Meat Shelf"] = "Raw meat should have a solid shelf all to itself to prevent harmful microbes transferring to other food.";
		outroStrings["Raw Meat Hands"] = "After you handle raw meat, you should wash your hands to prevent harmful microbes from spreading.";

		*/
		
		outro.text1.text = outroStrings["Fruit"];
		outro.multiplier1.text = levelScores[ FoodItem.TYPE_FRUIT ]["correct"] +"";
		outro.sum1.text = levelScores[ FoodItem.TYPE_FRUIT ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_FRUIT ]["correct"] * 10;
		
		outro.text2.text = outroStrings["Vegetables"];
		outro.multiplier2.text = levelScores[ FoodItem.TYPE_VEGETABLES ]["correct"] +"";
		outro.sum2.text = levelScores[ FoodItem.TYPE_VEGETABLES ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_VEGETABLES ]["correct"] * 10;
		
		outro.text3.text = outroStrings["Cupboard Items"];
		outro.multiplier3.text = levelScores[ FoodItem.TYPE_CUPBOARD]["correct"] +"";
		outro.sum3.text = levelScores[ FoodItem.TYPE_CUPBOARD ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_CUPBOARD ]["correct"] * 10;
		
		outro.text4.text = outroStrings["Cheese"];
		outro.multiplier4.text = levelScores[ FoodItem.TYPE_CHEESE]["correct"] +"";
		outro.sum4.text = levelScores[ FoodItem.TYPE_CHEESE ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_CHEESE ]["correct"] * 10;
		
		outro.text5.text = outroStrings["Raw Meat"];
		outro.multiplier5.text = levelScores[ FoodItem.TYPE_RAW_MEAT]["correct"] +"";
		outro.sum5.text = levelScores[ FoodItem.TYPE_RAW_MEAT ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_RAW_MEAT ]["correct"] * 10;
		
		outro.text6.text = outroStrings["Cooked Meat"];
		outro.multiplier6.text = levelScores[ FoodItem.TYPE_COOKED_MEAT]["correct"] +"";
		outro.sum6.text = levelScores[ FoodItem.TYPE_COOKED_MEAT ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_COOKED_MEAT ]["correct"] * 10;
		
		outro.text7.text = outroStrings["Liquids"];
		outro.multiplier7.text = levelScores[ FoodItem.TYPE_DOOR]["correct"] +"";
		outro.sum7.text = levelScores[ FoodItem.TYPE_DOOR ]["correct"] * 10;
		overallScore += levelScores[ FoodItem.TYPE_DOOR ]["correct"] * 10;
		
		outro._visible = true;
		outro._alpha = 100;
	}
	
	function showOutroMissed() {
		outro.gotoAndPlay("missed");
		outro.click_button.callFunc = "showAdmonishments";
		outro.text0.text = outroStrings["Items Placed Incorrectly"];
		
		outro.text1.text = outroStrings["Fruit"];
		outro.multiplier1.text = levelScores[ FoodItem.TYPE_FRUIT ]["incorrect"] +"";
		outro.sum1.text = "- " +levelScores[ FoodItem.TYPE_FRUIT ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_FRUIT ]["incorrect"] * 10;
		
		outro.text2.text = outroStrings["Vegetables"];
		outro.multiplier2.text = levelScores[ FoodItem.TYPE_VEGETABLES ]["incorrect"] +"";
		outro.sum2.text = "- " +levelScores[ FoodItem.TYPE_VEGETABLES ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_VEGETABLES ]["incorrect"] * 10;
		
		outro.text3.text = outroStrings["Cupboard Items"];
		outro.multiplier3.text = levelScores[ FoodItem.TYPE_CUPBOARD]["incorrect"] +"";
		outro.sum3.text = "- " +levelScores[ FoodItem.TYPE_CUPBOARD ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_CUPBOARD ]["incorrect"] * 10;
		
		outro.text4.text = outroStrings["Cheese"];
		outro.multiplier4.text = levelScores[ FoodItem.TYPE_CHEESE]["incorrect"] +"";
		outro.sum4.text = "- " +levelScores[ FoodItem.TYPE_CHEESE ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_CHEESE ]["incorrect"] * 10;
		
		outro.text5.text = outroStrings["Raw Meat"];
		outro.multiplier5.text = levelScores[ FoodItem.TYPE_RAW_MEAT]["incorrect"] +"";
		outro.sum5.text = "- " +levelScores[ FoodItem.TYPE_RAW_MEAT ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_RAW_MEAT ]["incorrect"] * 10;
		
		outro.text6.text = outroStrings["Cooked Meat"];
		outro.multiplier6.text = levelScores[ FoodItem.TYPE_COOKED_MEAT]["incorrect"] +"";
		outro.sum6.text = "- " +levelScores[ FoodItem.TYPE_COOKED_MEAT ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_COOKED_MEAT ]["incorrect"] * 10;
		
		outro.text7.text = outroStrings["Liquids"];
		outro.multiplier7.text = levelScores[ FoodItem.TYPE_DOOR]["incorrect"] +"";
		outro.sum7.text = "- " +levelScores[ FoodItem.TYPE_DOOR ]["incorrect"] * 10;
		overallScore -= levelScores[ FoodItem.TYPE_DOOR ]["incorrect"] * 10;
		
		outro.click_button.onRelease = function() {
			var callback : Object = this["callObj"];
			var callFunc : String = this["callFunc"];
			callback[callFunc]();
		}
	}
	
	function showAdmonishments() {
		outro.gotoAndPlay("admonishments");
		/*
		 * 	outroStrings["Shopping Placed Correctly"] = "Shopping Placed Correctly";
		outroStrings["Fruit"] = "Fruit";
		outroStrings["Vegetables"] = "Vegetables";
		outroStrings["Cupboard Items"] = "Cupboard Items";
		outroStrings["Cheese"] = "Cheese";
		outroStrings["Raw Meat"] = "Raw Meat";
		outroStrings["Cooked Meat"] = "Cooked Meat";
		outroStrings["Points Awarded"] = "Points Awarded";
		outroStrings["Items Placed Incorrectly"] = "Items Placed Incorrectly";
		outroStrings["Microbial Mistakes"] = "Microbial Mistakes";
		outroStrings["Points Deducted"] = "Points Deducted";
		outroStrings["Total Points"] = "Total Points";
		outroStrings["Clingfilm"] = "Raw and Cooked meat should be covered before putting away.";
		outroStrings["Sneeze"] = "If you don't cover your mouth when you sneeze, you can spread harmful microbes.";
		outroStrings["Sneeze Hands"] = "Even if you use a tissue when you sneeze, you should wash your hands before handling food.";
		outroStrings["Bad Food"] = "If food is mouldy or off, you should throw it away.";
		outroStrings["Burst Container"] = "If a liquid container is burst you should throw it away.";
		outroStrings["Cooked Meat Shelf"] = "Cooked meat should be covered and placed on its own shelf.";
		outroStrings["Raw Meat Shelf"] = "Raw meat should have a solid shelf all to itself to prevent harmful microbes transferring to other food.";
		outroStrings["Raw Meat Hands"] = "After you handle raw meat, you should wash your hands to prevent harmful microbes from spreading.";
*/
		
		outro.text0.text = outroStrings["Microbial Mistakes"];
		for ( var i = 0; i < levelAdmonishments.length; i++ ) {
			outro["text" + (i + 1)].text = levelAdmonishments[i];
		}
		
		outro.click_button.callFunc = "nextLevel";
		
		outro.click_button.onRelease = function() {
			var callback : Object = this["callObj"];
			var callFunc : String = this["callFunc"];
			callback[callFunc]();
		}
	}
	
	function calculateScores() {
		var clingfilm : Boolean = false;
		var sneeze : Boolean = false;
		var sneezeHands : Boolean = false;
		var badFood : Boolean = false;
		var burstContainer : Boolean = false;
		var cookedMeatShelf : Boolean = false;
		var rawMeatShelf : Boolean = false;
		var rawMeatHands : Boolean = false;
		
		for ( var locationId : Number = 0; locationId < levelFoodChoices.length; locationId++ ) {
			var locationFood : Array = levelFoodChoices[ locationId ];
			for ( var foodId : Number = 0; foodId < locationFood.length; foodId++ ) {
				var storedFood : FoodItem = FoodItem( locationFood[ foodId ] );
				if ( levelScores[ storedFood.foodType ] == undefined ) {
					levelScores[ storedFood.foodType ] = new Array();
					levelScores[ storedFood.foodType ]["correct"] = 0;
					levelScores[ storedFood.foodType ]["incorrect"] = 0;
				}
				
				if ( storedFood.foodState[ FoodItem.FOOD_STATE_SNEEZE_MICROBES ] ) {
					if ( !sneeze ) {
						sneeze = true;
						levelAdmonishments.push( outroStrings["Sneeze"]);
					}
				}
				
				switch ( locationId ) {
					case LOCATION_TYPE_BIN :
						if ( storedFood.foodState[ FoodItem.FOOD_STATE_MOULDY ] == true || storedFood.foodState[ FoodItem.FOOD_STATE_BURST ] == true ) {
							 // do nothing?
							 ;
						} else {
							// binned a good item
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_BOWL :
						if ( storedFood.foodType == FoodItem.TYPE_FRUIT ) {
							// if mouldy, bad choice
							if ( storedFood.foodState[ FoodItem.FOOD_STATE_MOULDY ] == true ) {
								levelScores[ storedFood.foodType ]["incorrect"] ++;
								if ( !badFood ) {
									levelAdmonishments.push( outroStrings["Bad Food"] );
								}
							} else {
								// must be fine fruit
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_CUPBOARD :
						if ( storedFood.foodType == FoodItem.TYPE_CUPBOARD ) {
							// if mouldy, bad choice
							if ( storedFood.foodState[ FoodItem.FOOD_STATE_MOULDY ] == true ) {
								levelScores[ storedFood.foodType ]["incorrect"] ++;
								if ( !badFood ) {
									levelAdmonishments.push( outroStrings["Bad Food"] );
									badFood = true;
								}
							} else {
								// must be fine tins / bread
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_FRIDGE_DOOR :
						if ( storedFood.foodType == FoodItem.TYPE_DOOR ) {
							// if burst, bad choice
							if ( storedFood.foodState[ FoodItem.FOOD_STATE_BURST ] == true ) {
								levelScores[ storedFood.foodType ]["incorrect"] ++;
								if ( burstContainer == false ) {
									levelAdmonishments.push( outroStrings["Burst Container"] );
									burstContainer = true;
								}
							} else {
								// must be fine drinks / yogurt
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_FRIDGE_DRAWER :
						if ( storedFood.foodType == FoodItem.TYPE_VEGETABLES ) {
							// if mouldy, bad choice (no actual mouldy veg in game at present)
							if ( storedFood.foodState[ FoodItem.FOOD_STATE_MOULDY ] == true ) {
								levelScores[ storedFood.foodType ]["incorrect"] ++;
							} else {
								// must be fine veg
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_FRIDGE_LOWER :
						if ( storedFood.foodType == FoodItem.TYPE_RAW_MEAT ) {
							if ( storedFood.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] == false ) {
								if ( !clingfilm ) {
									levelAdmonishments.push(outroStrings["Clingfilm"]);
									clingfilm = true;
								}
								levelScores[ storedFood.foodType ]["incorrect"] ++;
							} else {
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_FRIDGE_MID :
						if ( storedFood.foodType == FoodItem.TYPE_CHEESE || storedFood.foodType == FoodItem.TYPE_COOKED_MEAT ) {
							if ( storedFood.foodType == FoodItem.TYPE_COOKED_MEAT ) {
								if ( storedFood.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] == false ) {
									if ( !clingfilm ) {
										levelAdmonishments.push(outroStrings["Clingfilm"]);
										clingfilm = true;
									}
									levelScores[ storedFood.foodType ]["incorrect"] ++;
								} else {
									levelScores[ storedFood.foodType ]["correct"] ++;
								}
							} else {
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					case LOCATION_TYPE_FRIDGE_UPPER :
						if ( storedFood.foodType == FoodItem.TYPE_CHEESE || storedFood.foodType == FoodItem.TYPE_COOKED_MEAT ) {
							if ( storedFood.foodType == FoodItem.TYPE_COOKED_MEAT ) {
								if ( storedFood.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] == false ) {
									if ( !clingfilm ) {
										levelAdmonishments.push(outroStrings["Clingfilm"]);
										clingfilm = true;
									}
									levelScores[ storedFood.foodType ]["incorrect"] ++;
								} else {
									levelScores[ storedFood.foodType ]["correct"] ++;
								}
							} else {
								levelScores[ storedFood.foodType ]["correct"] ++;
							}
						} else {
							// whatever it is, it doesn't go here
							levelScores[ storedFood.foodType ]["incorrect"] ++;
							addFoodLocationAdmonishments( storedFood );
						}
						break;
					default :
						trace ("unknown location in calculate scores" + locationId)
						break;
				}
			}
		}
		
		for ( var i = 0; i < 10; i++) {
			if ( levelScores[ i ] == undefined ) {
				levelScores[ i ] = new Array();
				levelScores[ i ]["correct"] = 0;
				levelScores[ i ]["incorrect"] = 0;
			}
		}
		/*
		trace ( "finished calculating scores");
		trace ("correct fruit: " + levelScores[ FoodItem.TYPE_FRUIT]["correct"]);
		trace ("incorrect fruit: " + levelScores[ FoodItem.TYPE_FRUIT]["incorrect"]);
		
		trace ("correct veg: " + levelScores[ FoodItem.TYPE_VEGETABLES]["correct"]);
		trace ("incorrect veg: " + levelScores[ FoodItem.TYPE_VEGETABLES]["incorrect"]);
		*/
	}
	
	function startSneeze() {
		gameState = STATE_SNEEZE_START;
		avatar.gotoAndPlay("sneeze_Start");
		sneezeTimer = setInterval( this, "makeSneeze", 2000);
		gameState = STATE_SNEEZE_START;
	}
	
	function addFoodLocationAdmonishments(foodItem : FoodItem) {
		switch ( foodItem.foodType ) {
			case FoodItem.TYPE_CHEESE :
				if ( !remindedCheese ) {
					levelAdmonishments.push( outroStrings["Cheese Location"] );
					remindedCheese = true;
				}
				break;
			case FoodItem.TYPE_COOKED_MEAT :
				if ( !remindedCookedMeat) {
					levelAdmonishments.push( outroStrings["Cooked Meat Location"] );
					remindedCookedMeat = true;
				}
				break;
			case FoodItem.TYPE_CUPBOARD:
				if ( !remindedCupboardItems) {
					levelAdmonishments.push( outroStrings["Cupboard Items Location"] );
					remindedCupboardItems = true;
				}
				break;
			case FoodItem.TYPE_DOOR :
				if ( !remindedLiquids) {
					levelAdmonishments.push( outroStrings["Liquids Location"] );
					remindedLiquids = true;
				}
				break;
			case FoodItem.TYPE_FRUIT :
				if ( !remindedFruit) {
					levelAdmonishments.push( outroStrings["Fruit Location"] );
					remindedFruit = true;
				}
				break;
			case FoodItem.TYPE_RAW_MEAT:
				if ( !remindedRawMeat) {
					levelAdmonishments.push( outroStrings["Raw Meat Location"] );
					remindedRawMeat = true;
				}
				break;
			case FoodItem.TYPE_VEGETABLES :
				if ( !remindedVeg) {
					levelAdmonishments.push( outroStrings["Vegetables Location"] );
					remindedVeg = true;
				}
				break;
			default :
				trace("Misplaced item type: " + foodItem.foodType);
				break;
		}
	}
	
	function makeSneeze() {
		clearInterval(sneezeTimer);
		gameState = STATE_WAIT;
		currentFoodItem.foodState[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = true;
		// infect hand with sneeze microbes
		handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = true;
		//todo
		//make food glow or something
		avatar.gotoAndPlay("sneeze_food_end");
	}
	
	function sneezeHankie() {
		clearInterval(sneezeTimer);
		gameState = STATE_WAIT;
		// infect hand with sneeze microbes
		handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = true;
		avatar.gotoAndPlay("sneeze_tissue_end");
	}
	
	function removeBinItem() {
		var bin : MovieClip = theGame[ "restpointBin" ].content;
		if ( bin.content._alpha > 0 ) {
			bin.content._alpha -= 5;
			bin.clingfilm._alpha-= 5;
		} else {
			clearInterval(removeBinItemTimer);
		}
	}
	
	// here - need to manage re: scoring etc...
	function receiveInput( buttonName : String ) {
		if ( gameState == STATE_SNEEZE_START ) {
			if ( buttonName == "tissues" ) {
				sneezeHankie();
			} else {
				makeSneeze();
			}
		} else if ( gameState == STATE_WAIT ) {
			/*
			 * if restpoint, then it's a throw action, would set state to throw but since throwing is broken, going straight to store
			 */
			if ( buttonName.substr(0, 9) == "restpoint" ) {
				var locationType : Number;
				// pick avatar animation
				if (  buttonName == "restpointCupboardBottomRight" || buttonName == "restpointCupboardTopLeft" || buttonName == "restpointCupboardTopRight" || buttonName == "restpointCupboardMidLeft" || buttonName == "restpointCupboardMidRight" || buttonName == "restpointCupboardBottomLeft" || buttonName == "") {
					// throw cupboard
					avatar.gotoAndPlay("cupboard");
					locationType = LOCATION_TYPE_CUPBOARD;
				} else if ( buttonName.substr(0, 15) == "restpointFridge") {
					avatar.gotoAndPlay("fridge");
					
					if ( buttonName.substr(0, 18) == "restpointFridgeTop" ) {
						locationType = LOCATION_TYPE_FRIDGE_UPPER;
					} else if (buttonName.substr(0, 18) == "restpointFridgeMid" ) {
						locationType = LOCATION_TYPE_FRIDGE_MID;
					} else if (buttonName.substr(0, 18) == "restpointFridgeBot" ) {
						locationType = LOCATION_TYPE_FRIDGE_LOWER;
					} else if (buttonName.substr(0, 18) == "restpointFridgeBox" ) {
						locationType = LOCATION_TYPE_FRIDGE_DRAWER;
					} else if ( buttonName.substr(0, 18) == "restpointFridgeSid" ) {
						locationType = LOCATION_TYPE_FRIDGE_DOOR;
					}
					
					
				} else if ( buttonName.substr(0, 18) == "restpointFruitBowl") {
					avatar.gotoAndPlay("bowl");
					locationType = LOCATION_TYPE_BOWL;
				} else if ( buttonName.substr(0, 12) == "restpointBin") {
					avatar.gotoAndPlay("bin");
					locationType = LOCATION_TYPE_BIN;
					
					clearInterval(removeBinItemTimer);
					removeBinItemTimer = setInterval(this, "removeBinItem", 40);
				} else trace (buttonName);
				
				// store food
				
				// update food item to reflect hand cleanliness
				if ( handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] == true ) {
					currentFoodItem.foodState[ FoodItem.FOOD_STATE_SNEEZE_MICROBES ] = true;
					// limit spread to just one item
					handStates[FoodItem.FOOD_STATE_SNEEZE_MICROBES] = false;
				}
				if ( handStates[FoodItem.FOOD_STATE_CLINGFILMED] == true ) {
					currentFoodItem[FoodItem.FOOD_STATE_MEAT_MICROBES] = true;
					// limit spread to just one item
					handStates[FoodItem.FOOD_STATE_MEAT_MICROBES] = false;
				}
				
				// infect hand if food is raw meat
				if ( currentFoodItem.foodType == FoodItem.TYPE_RAW_MEAT ) {
					handStates[ FoodItem.FOOD_STATE_MEAT_MICROBES ] = true;
				}
				
				var scale : Number ;
				var box : MovieClip = theGame[ buttonName ].content;
				if ( foodContainer.content._width > foodContainer.content._height) {
					scale = box._width / foodContainer.content._width;
				} else {
					scale = box._height / foodContainer.content._height;
				}
				var floorOffset : Number =  box._height - ( foodContainer.content._height * scale );
				
				// remove food from invisible box
				foodContainer.content.removeMovieClip();
				foodContainer.clingfilm.removeMovieClip();
				
				// now load the food into the resting area
				box.content.removeMovieClip();
				box.clingfilm.removeMovieClip();
				box.attachMovie(currentFoodItem.assetName, "content", box.getNextHighestDepth(), { _xscale: (scale * 100), _yscale:(scale * 100), _y:floorOffset } );
				
				if ( currentFoodItem.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] ) {
					box.attachMovie("clingfilm_" + currentFoodItem.assetName, "clingfilm", box.getNextHighestDepth(), { _xscale: (scale * 100), _yscale:(scale * 100), _y:floorOffset } );
				}
				
				var content : MovieClip = box["content"];
				if ( box._width > box._height ) {
					// defined by width.
					var ratio = box._width / box._height;
					if ( content._width > content._height ) {
						content._width = box._width;
					}
				}
				content._visible = true;
				box["content"]._visible = true;
				
				// update scoring array
				if ( levelFoodChoices[ locationType ] == undefined ) {
					levelFoodChoices[ locationType ] = new Array();
				} 
				levelFoodChoices[ locationType ].push( currentFoodItem );
				
				
				/*
				for ( var i = 0; i < levelFoodChoices.length; i++) {
					var temp : FoodItem = FoodItem( levelFoodChoices[i] );
					trace ("sneezed?" + temp.foodState[ FoodItem.FOOD_STATE_SNEEZE_MICROBES ] );
					trace ("clingfilmed? " + temp.foodState [ FoodItem.FOOD_STATE_CLINGFILMED ] );
					//trace ("item: " + levelFoodChoices[i] );
				}*/
				
				// now get another food item.
				currentFoodItemId ++;
				gameState = STATE_PICK_ITEM
				/*foodThrowArea.gotoAndStop("bowl");
				
				
				foodContainer = foodThrowArea["foodContainer"];
				foodContainer.attachMovie(currentFoodItem.assetName, "content", foodContainer.getNextHighestDepth(), {_visible:false});
				var heightOfContent : Number = 	foodContainer.content._height;
				var heightOfContainer : Number = foodContainer._height;
				var diff : Number = heightOfContainer - heightOfContent;
				foodContainer.content._y += diff;
				
				var widthOfContent: Number = foodContainer.content._width;
				var widthOfContainer: Number = foodContainer._width;
				diff = widthOfContainer - widthOfContent;
				foodContainer.content._x += diff;
				
				foodContainer.content._visible = true;
				foodThrowArea.play();*/				
			} else if ( buttonName == "clingfilm" ) {
				var xPos : Number = foodContainer.content._x;
				var yPos : Number = foodContainer.content._y;
				var scale : Number = foodContainer.content._xscale;
				
				foodContainer.attachMovie("clingfilm_" + currentFoodItem.assetName, "clingfilm", foodContainer.getNextHighestDepth(), { _x:xPos, _y:yPos, _xscale:scale, _yscale:scale } );
				currentFoodItem.foodState[ FoodItem.FOOD_STATE_CLINGFILMED ] = true;
				
			} else if ( buttonName == "sink_area") {
				gameState = STATE_WASH_HANDS;
				avatar.gotoAndPlay("wash_hands");
			} 
		}
	}
	
	
	function pickItem() {
		if ( currentFoodItemId >= levelFood.length ) {
			gameState = STATE_END_OF_LEVEL;
		} else {
			currentFoodItem = allPossibleFood[ levelFood[ currentFoodItemId ] ];
			foodContainer.attachMovie(currentFoodItem.assetName, "content", foodContainer.getNextHighestDepth(), { _visible: false } );
			var heightOfContent : Number = 	foodContainer.content._height;
			var heightOfContainer : Number = foodContainer._height;
			var diff : Number = heightOfContainer - heightOfContent;
			foodContainer.content._y += diff;
			
			var widthOfContent: Number = foodContainer.content._width;
			var widthOfContainer: Number = foodContainer._width;
			diff = widthOfContainer - widthOfContent;
			foodContainer.content._x += diff;
			
			foodContainer.content._visible = true;
			
			gameState = STATE_WAIT;
		}
	}
	
	function exitKitchenGame() {
		trace("Now Exiting Kitchen Game\nOverall Score: " + overallScore);
		//outro._visible = false;
		//theGame._visible = false;
		player.score += overallScore;
		//trace ("root is: " + theRoot);
	//	trace ("stage is " + theStage);
		_root.endOfKitchen(player);
		// now pass back to main...
	}
	
	function nextLevel(levelId : Number) {
		if ( levelId == undefined ) {
			levelId = level + 1;
		}
		level = levelId;
			
		// remove items from restPoints
		for ( var i = 0; i < restingPoints.length; i++) {
			var box : MovieClip = theGame[ restingPoints[i] ].content;
			box.content.removeMovieClip();
		}
		
		if ( level > 3 ) {
			exitKitchenGame();
		} else { trace ( "\nStarting Level: " + level + "\n");
		
			outro._visible = false;
	//		outro.gotoAndStop("achievements");
		
			remindedFruit = false;
			remindedVeg = false;
			remindedCheese = false;
			remindedRawMeat = false;
			remindedCookedMeat = false;
			remindedLiquids = false;
			remindedCupboardItems = false;
		

			currentFoodItemId = 0;
			levelFood = new Array();
			
			if ( levelId == 3 ) {
				timeLeft = 120;
			} else {
				timeLeft = 60;
			}
			
			levelFood = new Array();
			currentFoodItemId = 0;
			
			handStates = new Array();
			
			prepareLevelFood();
			
			if ( level > 0 ) {
				levelSneezes = true;
				sneezeChance = 7;
			}
			
			levelScores = new Array();
			levelAdmonishments = new Array();
			
			// show intro
			intros[level]._visible = true;
			
			// when intro is finished, start level.
			// do iterator here....
			interval = setInterval(this, "introFinished", 40);
		}
	}
	
	function introFinished() {
		//temp
		//intros[level].finished = true;
		
		if ( intros[level].finished == true ) {
			clearInterval(interval);
			intros[level]._visible = false;
			theGame._visible = true;
			theGame._alpha = 100;
			timer = getTimer();
			gameState = STATE_PICK_ITEM;
			interval = setInterval(this, "main", 40);
		}
	}
	
	
	
	function outroFinished() {
		//temp
		//intros[level].finished = true;
		
/*		if ( outros[level].finished == true ) {
			clearInterval(interval);
			outros[level]._visible = false;
			theGame._visible = true;
			theGame._alpha = 100;
			timer = getTimer();
			gameState = STATE_PICK_ITEM;
			interval = setInterval(this, "main", 40);
		}*/
	}
	
	function prepareLevelFood() {
		levelFood = new Array();
		levelFoodChoices = new Array();
		
		if ( level == 0 ) {
			// 10 items, 30 seconds, veg and door items
			var veg : Number = 0;
			var door : Number = 1;
			
			for ( var i : Number = 0; i < 10; i++) {
				var high : Number = 1;
				var low : Number = 0;
				
				var random : Number = Math.round(Math.random() * (high -  low)) + low;
				
				if ( random == veg ) {
					high = foodVegetables.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodVegetables[random] )
				} else {
					high = foodDoor.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodDoor[random] )
				}
					
			}
			for ( var i = 0; i < levelFood.length; i++) {
				var food : FoodItem = allPossibleFood[ levelFood[i]  ];
				trace ( levelFood[i]  + " - " + food.name );
			}
		} else if ( level == 1 ) {
			// 10 items, 30 seconds, veg and door items
			var veg : Number = 0;
			var door : Number = 1;
			var fruit : Number = 2;
			var cupboard : Number = 3;
			
			for ( var i : Number = 0; i < 10; i++) {
				var high : Number = 3;
				var low : Number = 0;
				
				var random : Number = Math.round(Math.random() * (high -  low)) + low;
				
				if ( random == veg ) {
					high = foodVegetables.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodVegetables[random] )
				} else if ( random == door) {
					high = foodDoor.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodDoor[random] )
				} else if ( random == fruit) {
					high = foodFruit.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodFruit[random] )
				} else if ( random == cupboard) {
					high = foodCupboard.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCupboard[random] )
				}
					
			}
			for ( var i = 0; i < levelFood.length; i++) {
				var food : FoodItem = allPossibleFood[ levelFood[i]  ];
				trace ( levelFood[i]  + " - " + food.name );
			}
		} else if ( level == 2 ) {
			// 10 items, 30 seconds, all items
			var veg : Number = 0;
			var door : Number = 1;
			var fruit : Number = 2;
			var cupboard : Number = 3;
			var rawMeat : Number = 4;
			var cheese : Number = 5;
			var cookedMeat : Number = 6;
			
			for ( var i : Number = 0; i < 10; i++) {
				var high : Number = 6;
				var low : Number = 0;
				
				var random : Number = Math.round(Math.random() * (high -  low)) + low;
				
				if ( random == veg ) {
					high = foodVegetables.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodVegetables[random] );
				} else if ( random == door) {
					high = foodDoor.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodDoor[random] );
				} else if ( random == fruit) {
					high = foodFruit.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodFruit[random] );
				} else if ( random == cupboard) {
					high = foodCupboard.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCupboard[random] );
				} else if ( random == rawMeat) {
					high = foodRawMeat.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodRawMeat[random] );
				} else if ( random == cheese) {
					high = foodCheese.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCheese[random] );
				} else if ( random == cookedMeat) {
					high = foodCookedMeat.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCookedMeat[random] );
				}
					
			}
			for ( var i = 0; i < levelFood.length; i++) {
				var food : FoodItem = allPossibleFood[ levelFood[i]  ];
				trace ( levelFood[i]  + " - " + food.name );
			}
		} else if ( level == 3 ) {
			// 20 items, 45 seconds, all items
			var veg : Number = 0;
			var door : Number = 1;
			var fruit : Number = 2;
			var cupboard : Number = 3;
			var rawMeat : Number = 4;
			var cheese : Number = 5;
			var cookedMeat : Number = 6;
			
			for ( var i : Number = 0; i < 20; i++) {
				var high : Number = 6;
				var low : Number = 0;
				
				var random : Number = Math.round(Math.random() * (high -  low)) + low;
				
				if ( random == veg ) {
					high = foodVegetables.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodVegetables[random] );
				} else if ( random == door) {
					high = foodDoor.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodDoor[random] );
				} else if ( random == fruit) {
					high = foodFruit.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodFruit[random] );
				} else if ( random == cupboard) {
					high = foodCupboard.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCupboard[random] );
				} else if ( random == rawMeat) {
					high = foodRawMeat.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodRawMeat[random] );
				} else if ( random == cheese) {
					high = foodCheese.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCheese[random] );
				} else if ( random == cookedMeat) {
					high = foodCookedMeat.length - 1;
					random = Math.round(Math.random() * high);
					levelFood.push( foodCookedMeat[random] );
				}
					
			}
			for ( var i = 0; i < levelFood.length; i++) {
				var food : FoodItem = allPossibleFood[ levelFood[i]  ];
				trace ( levelFood[i]  + " - " + food.name );
			}
		}
	}
	
	/*
	 * Movies that need text should use an array that is created in first frame.
	 * This function used to swap.
	 */
	function swapStrings(textAreas : Array, stringIndexes : Array)  {
		if ( textAreas.length != stringIndexes.length) {
			trace ("error " + textAreas.length + " text areas but " + stringIndexes.length + " strings");
		} else {
			for ( var areaIndex : Number = 0; areaIndex < textAreas.length; areaIndex++ ) {
				var textArea : TextField = TextField( textAreas[areaIndex] );
				textArea.text = strings[ stringIndexes[areaIndex] ];
			}
		}
	}
	
	/*
	 * AssetsLoaded wires up the movie clips to variables
	 */
	function assetsLoaded() {
		intros.push(assetLibrary.getAsset("kitchen_game_intro_level_0"));
		intros.push(assetLibrary.getAsset("kitchen_game_intro_level_1"));
		intros.push(assetLibrary.getAsset("kitchen_game_intro_level_2"));
		intros.push(assetLibrary.getAsset("kitchen_game_intro_level_3"));
		outro = assetLibrary.getAsset("kitchen_game_outro");
		theGame = assetLibrary.getAsset("kitchen_game_main");
		
		clock = theGame["clock"];
		
		if ( player.avatarSex == Player.FEMALE) {
			theGame.attachMovie("amy", "avatar", theGame.getNextHighestDepth(), { _x:65.5, _y:8.7 } );
		} else {
			theGame.attachMovie("harry", "avatar", theGame.getNextHighestDepth(), { _x:65.5, _y:8.7 } );
		}
		avatar = theGame["avatar"];
		var counterTop : MovieClip = theGame["kitchen_counter"];
		avatar.swapDepths( counterTop );
		// the 'upper' clip is the one we animate
		avatar = avatar.upper;
		
		var tissues : MovieClip = counterTop["tissues"];
		tissues.theGame = this;
		tissues.onRelease = function() {
			this["theGame"].receiveInput(this._name);
		}
		
		var sink_area : MovieClip = counterTop["sink_area"];
		sink_area.theGame = this;
		sink_area.onRelease = function() {
			this["theGame"].receiveInput(this._name);
		}
		
		var clingfilm : MovieClip = counterTop["clingfilm"];
		clingfilm.theGame = this;
		clingfilm.onRelease = function() {
			this["theGame"].receiveInput(this._name);
		}
		
		foodThrowArea = theGame["food_throw_area"];
		
		foodContainer = foodThrowArea["foodContainer"];
		foodThrowArea.swapDepths( theGame.getNextHighestDepth());
		
		restingPoints = new Array( "restpointCupboardTopLeft", "restpointCupboardTopRight", "restpointCupboardMidLeft", "restpointCupboardMidRight", "restpointCupboardBottomLeft", "restpointCupboardBottomRight", 
		"restpointFruitBowlRight", "restpointFruitBowlTop", "restpointFruitBowlMid", "restpointFruitBowlLeft", "restpointFridgeTopLeft", 
		"restpointFridgeTopRight", "restpointFridgeMidLeft", "restpointFridgeMidRight", "restpointFridgeBottomLeft", "restpointFridgeBottomRight", "restpointFridgeBoxLeftFrontLeft", 
		"restpointFridgeBoxLeftBack", "restpointFridgeBoxLeftFrontRight", "restpointFridgeBoxRightBack", "restpointFridgeBoxRightFrontLeft", "restpointFridgeBoxRightFrontRight", 
		"restpointFridgeSideTopBack", "restpointFridgeSideTopFront", "restpointFridgeSideBottomFront", "restpointFridgeSideBottomBack", "restpointBin" );
		for ( var i : Number = 0; i < restingPoints.length; i++) {
			var btn : MovieClip = theGame[ restingPoints[i] ];
			btn["callObj"] = this;
			btn["callFunc"] = "receiveInput";
		}
		
		//todo hack - this clip isn't working via getasset
		outro = assetLibrary.assets["kitchen_game_outro"];
		
		
		assetLibrary.loadingScreen._visible = false;
		theStage._visible = true;
		//outro._visible = true;
		//outro._alpha = 100;
		
		nextLevel(0);
	}
	
	// todo replace with strings load
	function populateOutroStrings() {
		
		outroStrings["Shopping Placed Correctly"] = "Shopping Placed Correctly";
		outroStrings["Fruit"] = "Fruit";
		outroStrings["Vegetables"] = "Vegetables";
		outroStrings["Cupboard Items"] = "Cupboard Items";
		outroStrings["Cheese"] = "Cheese";
		outroStrings["Raw Meat"] = "Raw Meat";
		outroStrings["Liquids"] = "Liquids";
		outroStrings["Cooked Meat"] = "Cooked Meat";
		outroStrings["Points Awarded"] = "Points Awarded";
		outroStrings["Items Placed Incorrectly"] = "Items Placed Incorrectly";
		outroStrings["Microbial Mistakes"] = "Microbial Mistakes";
		outroStrings["Points Deducted"] = "Points Deducted";
		outroStrings["Total Points"] = "Total Points";
		outroStrings["Clingfilm"] = "Raw and Cooked meat should be covered before putting away.";
		outroStrings["Sneeze"] = "If you don't cover your mouth when you sneeze, you can spread harmful microbes.";
		outroStrings["Sneeze Hands"] = "Even if you use a tissue when you sneeze, you should wash your hands before handling food.";
		outroStrings["Bad Food"] = "If food is mouldy or off, you should throw it away.";
		outroStrings["Burst Container"] = "If a liquid container is burst you should throw it away.";
		outroStrings["Cooked Meat Shelf"] = "Cooked meat should be covered and placed on its own shelf.";
		outroStrings["Raw Meat Shelf"] = "Raw meat should have a solid shelf all to itself to prevent harmful microbes transferring to other food.";
		outroStrings["Raw Meat Hands"] = "After you handle raw meat, you should wash your hands to prevent harmful microbes from spreading.";
		outroStrings["Fruit Location"] = "Fruit should be put in the fruit bowl.";
		outroStrings["Vegetables Location"] = "Vegetables should be put in the bottom drawer in the fridge.";
		outroStrings["Cheese Location"] = "Cheese should go in the top or middle shelf.";
		outroStrings["Cooked Meat Location"] = "Cooked Meat should go in the top or middle shelf - and have a shelf all on its own.";
		outroStrings["Raw Meat Location"] = "Raw Meat should go on the solid shelf above the drawers.";
		outroStrings["Liquids Location"] = "Liquids should be put in the fridge door.";
		outroStrings["Cupboard Items Location"] = "Things like cans and bread should be put in the cupboard.";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";
		outroStrings[""] = "";

	}
	
	function populateValidLocations() {
/*			public static var TYPE_FRUIT 			: Number = 0;
	public static var TYPE_VEGETABLES 		: Number = 1;
	public static var TYPE_CUPBOARD			: Number = 4;
	public static var TYPE_CHEESE			: Number = 5;
	public static var TYPE_DOOR				: Number = 6;
	public static var TYPE_RAW_MEAT 		: Number = 7;
	public static var TYPE_COOKED_MEAT		: Number = 9;
*/ 
		validLocations[ FoodItem.TYPE_FRUIT ] = new Array();
		validLocations[ FoodItem.TYPE_VEGETABLES ] = new Array();
		validLocations[ FoodItem.TYPE_CUPBOARD ] = new Array();
		validLocations[ FoodItem.TYPE_CHEESE ] = new Array();
		validLocations[ FoodItem.TYPE_DOOR ] = new Array();
		validLocations[ FoodItem.TYPE_RAW_MEAT ] = new Array();
		validLocations[ FoodItem.TYPE_COOKED_MEAT ] = new Array();
		
		validLocations[ FoodItem.TYPE_FRUIT ]		[LOCATION_TYPE_BOWL] 			= true;
		validLocations[ FoodItem.TYPE_VEGETABLES]	[LOCATION_TYPE_FRIDGE_DRAWER] 	= true;
		validLocations[ FoodItem.TYPE_CUPBOARD]		[LOCATION_TYPE_CUPBOARD] 		= true;
		validLocations[ FoodItem.TYPE_CHEESE]		[LOCATION_TYPE_FRIDGE_UPPER] 	= true;
		validLocations[ FoodItem.TYPE_CHEESE]		[LOCATION_TYPE_FRIDGE_MID] 		= true;
		validLocations[ FoodItem.TYPE_DOOR ]		[LOCATION_TYPE_FRIDGE_DOOR]		= true;
		validLocations[ FoodItem.TYPE_RAW_MEAT ]	[LOCATION_TYPE_FRIDGE_LOWER]	= true;
		validLocations[ FoodItem.TYPE_COOKED_MEAT ] [LOCATION_TYPE_FRIDGE_MID]		= true;
		validLocations[ FoodItem.TYPE_COOKED_MEAT ] [LOCATION_TYPE_FRIDGE_UPPER] 	= true;

//		trace (validLocations);
	}
	
	function populateFoodList() {
		allPossibleFood = new Array();
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_CUPBOARD, null, "Mouldy Bread", "mouldy_bread"));
		
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MOULDY ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_DOOR, null, "Burst Yogurt", "burst_yogurt"));
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_BURST ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_VEGETABLES, null, "Carrots", "carrots"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_VEGETABLES, null, "Tomatoes", "tomatoes"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Orange", "orange"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Bananas", "bananas"));
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Mouldy Orange", "mouldy_orange"));
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MOULDY ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_DOOR, null, "Yogurt", "yogurt"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_CHEESE, null, "cheese", "cheese"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_DOOR, null, "Orange Juice", "orange_juice"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Apple", "red_apple"));
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_RAW_MEAT, null, "Raw Lamb", "raw_lamb"));
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MEAT_MICROBES ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_RAW_MEAT, null, "Raw Chicken", "raw_chicken"));
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MEAT_MICROBES ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_RAW_MEAT, null, "Raw Sausages", "raw_sausages") );
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MEAT_MICROBES ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_RAW_MEAT, null, "Raw Steak", "raw_steak"));
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_MEAT_MICROBES ] = true;
		FoodItem(allPossibleFood[ (allPossibleFood.length - 1) ]).foodState[ FoodItem.FOOD_STATE_CLEAN ] = false;
		
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_COOKED_MEAT, null, "Cooked Steak", "cooked_steak"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_COOKED_MEAT, null, "Cooked Lamb", "cooked_lamb"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_COOKED_MEAT, null, "Cooked Chicken", "cooked_chicken"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Apple", "green_apple"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_FRUIT, null, "Pear", "pear"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_DOOR, null, "Milk", "milk"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_CUPBOARD, null, "Soup", "soup"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_DOOR, null, "Orange Juice", "orange_juice"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_VEGETABLES, null, "Broccoli", "broccoli"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_CUPBOARD, null, "Bread", "bread"));
		allPossibleFood.push( new FoodItem( FoodItem.TYPE_VEGETABLES, null, "Spring Onion", "spring_onion"));
		
		
		foodFruit = new Array();
		foodVegetables = new Array();
		foodCupboard = new Array();
		foodRawMeat = new Array();
		foodCookedMeat = new Array();
		foodDoor = new Array();
		foodCheese = new Array();
		
		for ( var i = 0; i < allPossibleFood.length; i++ ) {
			var currentFood : FoodItem = FoodItem( allPossibleFood[i] );
			switch (currentFood.foodType) {
				case FoodItem.TYPE_CHEESE : 
					foodCheese.push(i);
					break;
				case FoodItem.TYPE_COOKED_MEAT :
					foodCookedMeat.push(i);
					break;
				case FoodItem.TYPE_CUPBOARD :
					foodCupboard.push(i);
					break;
				case FoodItem.TYPE_DOOR :
					foodDoor.push(i);
					break;
				case FoodItem.TYPE_FRUIT :
					foodFruit.push(i);
					break;
				case FoodItem.TYPE_RAW_MEAT :
					foodRawMeat.push(i);
					break;
				case FoodItem.TYPE_VEGETABLES :
					foodVegetables.push(i);
					break;
				default :
					trace ("Unknown food type: " + currentFood.foodType);
					break;
			}
		}
	}
	

}
