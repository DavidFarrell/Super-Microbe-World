/**
 * @author sbbc231
 */


class ebug.Constants {

	/*
	 * Constants that relate to levels
	 */

	public static var EBUG_SRC_ROOT:String = "c:\\source\\ebug_code\\";

	// the order of these needs to match the order of sides in the tiles section of the xml file
	public static var LEFT:Number = 0;
	public static var TOP:Number = 1;
	public static var RIGHT:Number = 2;
	public static var BOTTOM:Number = 3;

	public static var EMPTY:Number = undefined;

	public static var TILE_WIDTH:Number = 50;
	public static var SCREEN_WIDTH:Number = 800;
	public static var SCREEN_HEIGHT:Number = 450;

	/*
	 * Entity List
	 */
	public static var GAME_ENTITY_PLAYER:Number = 0;
	public static var GAME_ENTITY_TILE:Number = 1;
	public static var GAME_ENTITY_ERASER:Number = 2;
	public static var GAME_ENTITY_GENERIC:Number = 3;
	public static var GAME_ENTITY_GOOD_MICROBE:Number = 4;
	public static var GAME_ENTITY_BAD_MICROBE:Number = 5;
	public static var GAME_ENTITY_PORTAL_EXIT:Number = 6;
	public static var GAME_ENTITY_PORTAL_ENTRANCE:Number = 7;
	public static var GAME_ENTITY_BULLET:Number = 8;
	public static var GAME_ENTITY_AMMO_PICKUP:Number = 9;
	public static var GAME_ENTITY_CAMERA_FLASH:Number = 10;
	
	
	public static var GAME_ENTITY_LUCY : Number = 11;
	public static var GAME_ENTITY_SANDY : Number = 12;
	public static var GAME_ENTITY_PATTY : Number = 13;
	public static var GAME_ENTITY_STEVE : Number = 14;
	
	
	public static var GAME_ENTITY_COLIN : Number = 15;
	public static var GAME_ENTITY_SLARG : Number = 16;
	public static var GAME_ENTITY_SLURM : Number = 17;
	public static var GAME_ENTITY_IGGY 	: Number = 18;
	public static var GAME_ENTITY_DONNA : Number = 19;	
	
	public static var GAME_ENTITY_MILK : Number = 20;	
	
	public static var GAME_ENTITY_ANTIBIOTIC_PICKUP : Number = 21;	
	public static var GAME_ENTITY_ANTIBIOTIC_BOMB : Number = 22;	
	public static var GAME_ENTITY_SUPERINFECTION : Number = 23;	

	/*
	 * Constants that relate to the 'game'
	 */
	public static var STATE_INIT:Number 			= 0;
	public static var STATE_LEVEL_LOADING:Number 	= 1;
	public static var STATE_LEVEL_LOADED:Number 	= 2;
	public static var STATE_LOAD_TILES:Number 		= 3;
	public static var STATE_UPDATE_WORLD:Number 	= 4;
	public static var STATE_RENDER_WORLD:Number 	= 5;
	public static var STATE_CREATE_GUI:Number 		= 6;
	public static var STATE_FIND_LEVEL:Number 		= 7;
	public static var STATE_LOAD_LEVEL:Number 		= 8;
	public static var STATE_LEVEL_COMPLETE:Number 	= 9;
	public static var STATE_INIT_DIALOGUE:Number 	= 10;
	public static var STATE_DIALOGUE:Number 		= 11;
	public static var STATE_LEVEL_SUMMARY:Number 	= 12;
	public static var STATE_ROUND_TEXT:Number 		= 13;
	public static var STATE_CREATE_ENTITIES:Number 	= 14;
	public static var STATE_CLEAN_UP:Number 		= 15;
	public static var STATE_ASK_QUESTION:Number 	= 16;
	public static var STATE_SHOW_BOARD:Number 		= 17;
	public static var STATE_CHECK_ANSWER:Number 	= 18;
	public static var STATE_ROUND_OVER:Number 		= 20;
	
	
	

	public static var STATE_TRIGGER_WIN:Number 		= 995;
	public static var STATE_TRIGGER_LOSE:Number 	= 996;
	public static var STATE_GAME_OVER:Number 		= 997;
	public static var STATE_IDLE:Number 			= 998;
	public static var STATE_CLOSE:Number 			= 999;
}