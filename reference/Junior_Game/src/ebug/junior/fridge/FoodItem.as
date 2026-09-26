import ebug.*;
import ebug.junior.*;
import ebug.general.*;
import ebug.util.AssetLibrary;

class ebug.junior.fridge.FoodItem {
	public var foodType : Number;
	public var foodState : Array;
	public var name : String;
	public var assetName : String;
	
	public static var TYPE_FRUIT 			: Number = 0;
	public static var TYPE_VEGETABLES 		: Number = 1;
//	public static var TYPE_BAD_FRUID		: Number = 2;
//	public static var TYPE_BAD_CUPBOARD		: Number = 3;
	public static var TYPE_CUPBOARD			: Number = 4;
	public static var TYPE_CHEESE			: Number = 5;
	public static var TYPE_DOOR				: Number = 6;
	public static var TYPE_RAW_MEAT 		: Number = 7;
	//public static var TYPE_MEAT				: Number = 8;
	public static var TYPE_COOKED_MEAT		: Number = 9;
	/*public static var TYPE_					: Number = ;
	public static var TYPE_ 				: Number = ;
	public static var TYPE_ 				: Number = ;*/
	
	public static var FOOD_STATE_CLEAN				: Number = 0;
	public static var FOOD_STATE_SNEEZE_MICROBES	: Number = 1;
	public static var FOOD_STATE_MEAT_MICROBES		: Number = 2;
	public static var FOOD_STATE_CLINGFILMED		: Number = 3;
	public static var FOOD_STATE_BURST				: Number = 4;
	public static var FOOD_STATE_MOULDY				: Number = 5;
	
	
	function FoodItem(type : Number, state : Array, name : String, assetName : String) {
		this.foodType = type;
		this.foodState = state;
		this.name = name;
		this.assetName = assetName;
		if ( foodState == undefined || foodState == null || foodState.length == 0) {
			foodState = new Array();
			for ( var i = 0; i < 6; i++) {
				foodState[i] = false;
			}
			foodState[FOOD_STATE_CLEAN] = true;
		}
	}
	
	function clone() : FoodItem {
		var state : Array = new Array();
		for ( var i = 0; i < foodState.length; i++) {
			state[i] = foodState[i];
		}
		var copy = new FoodItem(foodType, state, name, assetName);
		return copy;
	}
	
	public function toString() : String {
		return ("FoodItem: name["+name+"], assetName["+assetName+"], foodType["+foodType+"], foodState["+foodState+"]");
	}
	
}
