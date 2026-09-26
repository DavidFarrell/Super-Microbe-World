import ebug.junior.*;

/**
 * @author sbbc231
 */
class ebug.junior.Event {
	public var type : Number;
	public var target : GameEntity;
	
	/*
	 * The type of event defines the structure of the params array.
	 * In most cases, zero or one params will be required.
	 * In these cases, the param can be directly accessed from params[0]
	 * Where more than one param is needed, the array structure will be defined
	 * in a comment above the appropriate type id below.
	 */
	public var params : Array;

	/*
	 * Event type id's follow:
	 */	
	public static var THINK : Number = 0;
	
	// params[0] == thinkTime;
	public static var IDLE : Number = 1;
	public static var LAND : Number = 2;
	// params[0] == damage
	public static var BE_HURT : Number = 3;
	public static var BE_KILLED : Number = 4;
	public static var SLIDE : Number = 5;
	public static var BE_PHOTOGRAPHED : Number = 6;
	public static var BE_LIFTED : Number = 7;
	
	// params[0] == entity that was collided with
	// params[1] == direction of force resulting from collision
	public static var COLLIDE : Number = 8;
	
	// params[0] == direction
	public static var WALK : Number = 9;
	
	public static var FALL : Number = 10;
	public static var REMOVE : Number = 11;
	// params[0] == BulletEntity.BULLET_TYPE_SOAP or BLOOD
	public static var CREATE_SOAP_BULLET : Number = 12;
	public static var CREATE_WHITE_BULLET : Number = 13;
	public static var CREATE_CAMERA_FLASH : Number = 14;
	
	// params[0] == points to add or subtract	
	public static var MODIFY_POINTS					: Number = 15;
	
	// params[0] == goal index
	// params[1] == true for tick, false for cross
	public static var MODIFY_GOAL_STATUS					: Number = 16;
	
	public static var MILK_GLASS_EVENT_TURN_TO_YOGURT : Number = 17;
	
	public static var PICKUP_ANTIBIOTIC : Number = 18;
	public static var CREATE_ANTIBIOTIC : Number = 19;
	public static var EXPLODE_ANTIBIOTIC  : Number = 20;
	
	public static var FAKE_KILL_SUPERINFECTION  : Number = 21;
	public static var KILL_SUPERINFECTION  : Number = 22;
	
	/*
	 * Player Control Events
	 */
	// params [0] == speed.  if NaN, assume default
	public static var PLAYER_ACCELERATE 			: Number = 50;
	// params [0] == speed.  if NaN, assume default
	public static var PLAYER_DECELERATE 			: Number = 51;
	public static var PLAYER_IDLE 					: Number = IDLE;
	public static var PLAYER_MOVE 					: Number = WALK;
	public static var PLAYER_TAKE_PHOTO 			: Number = 52;
	public static var PLAYER_USE_TRACTOR 			: Number = 53;
	public static var PLAYER_END_TRACTOR 			: Number = 54;
	public static var PLAYER_BE_HURT 				: Number = 55;
	public static var PLAYER_SHOOT_SOAP 			: Number = 56;
	public static var PLAYER_THROW_WHITE_BLOOD 		: Number = 57;
	public static var PLAYER_JUMP_START 			: Number = 58;
	public static var PLAYER_JUMP_MID 				: Number = 59;
	public static var PLAYER_JUMP_END 				: Number = 60;
	public static var PLAYER_ENTER_LEVEL 			: Number = 61;
	public static var PLAYER_EXIT_LEVEL 			: Number = 62;
	public static var PLAYER_RESET 					: Number = 63;
	public static var PLAYER_KEY_RELEASED_JUMP 		: Number = 64;
	public static var PLAYER_KEY_PRESSED_FIRE 		: Number = 65;
	public static var PLAYER_KEY_RELEASED_FIRE 		: Number = 66;
	public static var PLAYER_KEY_PRESSED_ALT_FIRE 	: Number = 67;
	public static var PLAYER_KEY_RELEASED_ALT_FIRE	: Number = 68;
	
	
	
	public static var TRIGGER_LEVEL_END 			: Number = 900;
	public static var TRIGGER_GAME_END 				: Number = 901;
	
	function Event (inType : Number, inTarget : GameEntity, inParams : Array) {
		type = inType;
		target = inTarget;
		params = inParams;
	}
}
