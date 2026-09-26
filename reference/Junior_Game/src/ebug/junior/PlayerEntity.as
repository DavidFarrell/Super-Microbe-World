import ebug.Constants;
import ebug.Entity;
import ebug.Vector3;
import ebug.junior.PlatformGame;
import ebug.Level;
import ebug.junior.*;
import ebug.Tile;
import ebug.ParticleSystem;

import flash.filters.BevelFilter;

/**
 * @author sbbc231
 */
class ebug.junior.PlayerEntity extends GameEntity {
 	public var upperState : Number;
 	public var lowerState : Number;
 	
 	/*
 	 * Both upper and lower clips have a property called midAnimation (bool)
 	 * that is set to true when between keyframes on important animations (like jump start)
 	 */
 	var upperClip : MovieClip;
 	var lowerClip : MovieClip;
 	
 	public var jumpReady : Boolean;
 	public var maxJumps : Number;
 	public var jumpsLeft : Number;
 	public var jumpForce : Number;
 	
 	public var fireButtonTime : Number;
 	public var triggerTractorTime : Number;
 	public var fireButtonLastCheck : Number;
 	
 	public var isShootingSoap : Boolean;
 	public var isUsingTractor : Boolean;
 	
 	public var canTakePhotograph : Boolean;
 	
 	public var fireButtonCode : Number;
 	public var altFireButtonCode : Number;
 	
 	public var maxAmmo : Number;
 	public var ammo : Number;
 	public var infiniteAmmo : Boolean;
 	
 	public var lives : Number;
 	public var infiniteLives : Boolean;
	
	public var has_antibiotic : Boolean;
 	
  	/* 
 	 * The following are keyboard actions recorded by PlatformGame
 	 * the 'up' action isn't when the key is up, but when it is only trigger when initially released
 	 */
 	// 
 	public var fire_down 		: Boolean = false;
	public var fire_up   		: Boolean = false;
 	public var alt_fire_down 	: Boolean = false;
	public var alt_fire_up   	: Boolean = false;
 	public var right_down 		: Boolean = false;
 	public var right_up 		: Boolean = false;
 	public var left_down 		: Boolean = false;
 	public var left_up 			: Boolean = false;
 	public var up_down 			: Boolean = false;
 	public var up_up 			: Boolean = false;
 	public var down_down 		: Boolean = false;
 	public var down_up 			: Boolean = false;
 	
 		
 	
 	/*
 	 * the following are valid upper states for the human player
 	 */
 	public static var UPPER_IDLE : Number = 0;
 	public static var UPPER_MOVE : Number = 1;
 	public static var UPPER_ACCELERATE : Number = 2;
 	public static var UPPER_DECELERATE : Number = 3;
 	public static var UPPER_TAKE_PHOTO : Number = 4;
 	public static var UPPER_USE_TRACTOR_BEAM : Number = 5;
 	public static var UPPER_RELEASE_TRACTOR_BEAM : Number = 6;
 	public static var UPPER_BE_HURT : Number = 7;
 	public static var UPPER_SHOOT_SOAP : Number = 8;
 	public static var UPPER_THOW_WHITE_BLOOD : Number = 9;
 	
 	public static var LOWER_IDLE : Number = 0;
 	public static var LOWER_MOVE : Number = 1;
 	public static var LOWER_ACCELERATE : Number = 2;
 	public static var LOWER_DECELERATE : Number = 3;
 	public static var LOWER_JUMP : Number = 4;
 	public static var LOWER_JUMP_LAND : Number = 5;
 	public static var LOWER_BE_HURT : Number = 6;
 	
 	/* 
 	 * Bespoke Player States
 	 */
 	public static var PLAYER_STATE_ENTER_LEVEL : Number = 100;
 	public static var PLAYER_STATE_BE_HURT : Number = 101;
 	public static var PLAYER_STATE_NORMAL : Number = 102;
 	 
 	public static var SHOOT_POINT : Number = 27;
 	
	public function PlayerEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip, inJumps: Number) {
		super(inGame,inParticle, inClip);
		jumpReady = true;
		upperState = UPPER_IDLE;
		lowerState = LOWER_IDLE;
		upperClip = clip["upper"];
		lowerClip = clip["lower"];
		maxJumps = (!isNaN(inJumps))?2:inJumps;
		jumpsLeft = maxJumps;
		jumpForce = speed;
		counterCeiling = 1;
		fireButtonTime = 0;
		triggerTractorTime = 250;
		isShootingSoap = true;
		isUsingTractor = false;
		canTakePhotograph = true;
		thinkTime = defaultThinkTime = 100;
		fireButtonCode = Key.SPACE;
		altFireButtonCode = Key.CONTROL;
		ammo = 0;
		maxAmmo = 10;
		infiniteAmmo = true;
		lives = 3;
		infiniteLives = false;
		has_antibiotic = false;
	}

	/*
	 * Advance will call act().  If act returns events, these are iterated through UNLESS otherwise escaped in the while loop below.
	 * If you want the event to pass up to the main loop, then you need to include the event type in the list.
	 */
	public function advance() : Array {
		//trace ("..player in advance");
		var events : Array = new Array();
		var internalEvents : Array = new Array();
		
		internalEvents = internalEvents.concat(checkKeys());
		internalEvents = internalEvents.concat(checkStateEvents());
		
		while (internalEvents.length > 0 ){
			var currentEvent : Event = Event(internalEvents.shift());
			if ( currentEvent.type == Event.CREATE_SOAP_BULLET  || currentEvent.type == Event.CREATE_CAMERA_FLASH || currentEvent.type == Event.CREATE_ANTIBIOTIC ) {
				events.push(currentEvent);
			} else {
				var newEvents : Array = act(currentEvent);
				if ( newEvents != null ) {
					internalEvents = internalEvents.concat(newEvents);
				}
			}
		}
		
		thinkTime --;
		/*if ( Math.abs(particle.position.y - particle.previousPosition.y) < SAFE_TRAVEL_DISTANCE ) {
			if (thinkTime <= 0) {
				particle.force = particle.force.add(new Vector3(0, (-1.1*theGame.particleSystem.gravity.y) , 0) );
				thinkTime = defaultThinkTime;
			}	
		}*/
		
		//trace ("..player out advance ("+events.length+")");
		return events;
	}
	
	public function act(e : Event) : Array {
		//trace ("..player in act");
		var events : Array = new Array();
		if (state == PlayerEntity.PLAYER_STATE_NORMAL) {
			switch ( e.type ) {
				case Event.PLAYER_ACCELERATE : 
					events = accelerate();
					break;	
				case Event.PLAYER_DECELERATE : 
					events = decelerate();
					break;
				case Event.PLAYER_JUMP_START : 
					events = jump_start();
					break;
				case Event.PLAYER_KEY_RELEASED_JUMP : 
					if ( jumpsLeft > 0 ) {
						jumpReady = true;	
					}
					break;
				case Event.PLAYER_KEY_PRESSED_ALT_FIRE :
					if (!has_antibiotic) {
						if ( canTakePhotograph ) {
							upperClip.gotoAndPlay("take_photo_start");
							upperState = UPPER_TAKE_PHOTO;
							canTakePhotograph = false;
							events.push(new Event(Event.CREATE_CAMERA_FLASH, this, null));	
						}
					} else { // fire antibiotic
						upperClip.gotoAndPlay("shoot_soap");
						//trace("throw antibiotic");
						events.push(new Event(Event.CREATE_ANTIBIOTIC, this, null));	
						//trace ("events is now size: " + events.length);
					}
					break;
				case Event.PLAYER_KEY_RELEASED_ALT_FIRE :
				/*
				 * 
				 trace ("released");
					if ( fireButtonTime < triggerTractorTime ) {
						if ( canTakePhotograph ) {trace ("180");
							trace ( "photo");
							canTakePhotograph = false;
							events.push(new Event(Event.CREATE_CAMERA_FLASH, this, null));
							events = takePhotograph();
							trace ("set zero 184");
							fireButtonTime = 0;							
						}
					} else {trace("188");
						if ( canTakePhotograph ) {
							canTakePhotograph = false;
							upperState = UPPER_RELEASE_TRACTOR_BEAM;
							upperClip.gotoAndPlay("use_tractor_beam_end");
							isUsingTractor = false;
							events = useTractor();	
						}	
					}
					*/
					break;
				case Event.PLAYER_KEY_PRESSED_FIRE :
					events = fireWeapon();
					break;
				case Event.CREATE_SOAP_BULLET : 
					events.push ( e );
					break;
				case Event.BE_KILLED :
					//trace ("die!");
					break;
				case Event.COLLIDE :
					if (e.params[0] instanceof BadMicrobe && state != PLAYER_STATE_BE_HURT ) {
						// hack - should have been covered elsewhere but there are timing issues - so the thing isn't dead when player touches 
						if ( BadMicrobe( e.params[0] ).lives > 0 ) {
							var params : Array = new Array();
							params.push (1);
							events.push( new Event(Event.BE_HURT, this, params));
							jumpsLeft = maxJumps; 
						}
					}
					break;
				case Event.BE_HURT :
					lives -= e.params[0];
					
					upperClip.gotoAndPlay("hurt");
					upperState = UPPER_BE_HURT;
					lowerClip.gotoAndPlay("hurt");
					lowerState = LOWER_BE_HURT;
					
					canTakePhotograph = true;
					isUsingTractor = false;
					fireButtonTime = 0;
					if ( lives <=0 ) {
						events.push( new Event(Event.BE_KILLED, this, params));
					} else {
						state = PLAYER_STATE_BE_HURT;
					}
					break;
			}
		}
		if ( events.length >= 1) {
			//trace("returning from player - " + events.length +" events" + " - " + events[0].type);
		}
		//trace ("out act");
		return events;	
	}
	
	public function takePhotograph() : Array {
		var events : Array = new Array();
		if ( upperState == UPPER_TAKE_PHOTO ) { 
			if ( upperClip["midAnimation"] == false ) {
				fireButtonTime = 0;
				canTakePhotograph = true;
				upperState = UPPER_MOVE;
			}
		} //else trace ("upper anim not suiteable for photo: " + upperState);
		
		
		return events;	
	}
	
	public function useTractor() : Array {
		trace("shouldn't be here");
		var events : Array = new Array();
		/*
		if ( upperState != UPPER_USE_TRACTOR_BEAM && upperState != UPPER_RELEASE_TRACTOR_BEAM  ) {
				upperState = UPPER_USE_TRACTOR_BEAM;
				trace ("use upper tractor");
			canTakePhotograph = false;
			upperClip.gotoAndPlay("use_tractor_beam_mid");
		} else if ( upperState == UPPER_USE_TRACTOR_BEAM ) {
			trace ("in use with state use " + isUsingTractor);
			if ( !isUsingTractor ) {trace (" is using == false");
				if ( upperClip["shoot"] == true ) {
					isUsingTractor = true;
					trace ("shoot tractor");trace (" is using = true");
				}
			}
		} else if ( upperState == UPPER_RELEASE_TRACTOR_BEAM ) {
			if ( upperClip["midAnimation"] == false ) {
				upperState = UPPER_MOVE;
				upperClip.gotoAndPlay("move");
			} else {
				trace ("Release tractor\nset zero 241");
				fireButtonTime = 0;	
				isUsingTractor = false;
				canTakePhotograph = true;	
			}
		}
		*/
		return events;	
	}
	
	public function fireWeapon() : Array {
		var events : Array = new Array();
		if ( upperState == UPPER_ACCELERATE || upperState == UPPER_DECELERATE
		  || upperState == UPPER_IDLE || upperState == UPPER_MOVE) {
			if (isShootingSoap && (ammo > 0 || infiniteAmmo) ) {
				upperState = UPPER_SHOOT_SOAP;
				upperClip.gotoAndPlay("shoot_soap");
				if (!infiniteAmmo) {
					ammo --;
				}
			}			
		} else if ( upperState == UPPER_SHOOT_SOAP ) {
			if ( upperClip["shoot"] == true ) {
				upperClip["shoot"] = false;
				var params : Array = new Array();
				params.push(BulletEntity.BULLET_TYPE_SOAP);
				events.push(new Event(Event.CREATE_SOAP_BULLET, this, params));
			}
			if ( upperClip["midAnimation"] == false ) {
				upperState = UPPER_MOVE;
				fireButtonTime = 0;
			}
		} else if ( upperState == UPPER_THOW_WHITE_BLOOD ) {
			if ( upperClip["shoot"] == true ) {
				var params : Array = new Array();
				params.push(BulletEntity.BULLET_TYPE_SOAP);
				events.push(new Event(Event.BE_LIFTED, this, params));
				upperClip["shoot"] = false;
			}
			if ( upperClip["midAnimation"] == false ) {
				upperState = UPPER_MOVE;
				fireButtonTime = 0;	
			}
		}// else trace ("upper anim not suiteable for shooting: " + upperState);
		
		
		return events;	
	}

	public function accelerate() : Array {
		var events : Array = new Array();
		
		// deal with lower body first
		if ( lowerState == LOWER_IDLE || 
				lowerState == LOWER_DECELERATE || 
				lowerState == LOWER_MOVE ) {
			lowerState = LOWER_ACCELERATE;
			lowerClip.gotoAndPlay("accelerate_start");
		}
		
		// upper body
		if ( upperState == UPPER_IDLE || 
				upperState == UPPER_MOVE || 
				upperState == UPPER_DECELERATE) {
			upperState = UPPER_ACCELERATE;
			upperClip.gotoAndPlay("accelerate_start");
		}
		
		// now apply force
		particle.force = particle.force.add(new Vector3( (speed * direction) , 0, 0));
				
		thinkTime = 0;	
		return events;
	}
	
	public function decelerate() : Array {
		var events : Array = new Array();
		
		// deal with lower body first
		if ( lowerState == LOWER_IDLE || 
				lowerState == LOWER_ACCELERATE || 
				lowerState == LOWER_MOVE) {
			lowerState = LOWER_DECELERATE;
			lowerClip.gotoAndPlay("decelerate_start");
		}
		
		// upper body
		if ( upperState == UPPER_IDLE || 
				upperState == UPPER_MOVE || 
				upperState == UPPER_ACCELERATE) {
			upperState = UPPER_DECELERATE;
			upperClip.gotoAndPlay("decelerate_start");
		}
		
		// now apply force
		particle.force = particle.force.add(new Vector3( (speed * direction * -1), 0, 0));
				
		thinkTime = 0;	
		return events;
	}
	
	/*
	 * Assume it is safe to jump
	 */
	public function jump_start() : Array {
		var events : Array = new Array();
		
		lowerState = LOWER_JUMP;
		lowerClip.gotoAndPlay("jump_start");
		
		particle.force = particle.force.add(new Vector3(0, ( -3 * jumpForce) , 0));
		//trace("jump");
		jumpsLeft--;
		jumpReady = false;
		counter = counterCeiling;
		
		thinkTime = 0;	
		return events;
	}
	
	public function jump_mid() : Array {
		var events : Array = new Array();
		
		if ( onSolidGround() ) {
			lowerState = LOWER_JUMP_LAND;
			lowerClip.gotoAndPlay("jump_end");
			jumpsLeft = maxJumps;
		} else {
			if ( upperState == UPPER_MOVE || upperState == UPPER_DECELERATE || upperState == UPPER_IDLE) {
				upperState = UPPER_ACCELERATE;
				upperClip.gotoAndPlay("accelerate_start");
			} else {
			}
		}
		
		direction = checkDirection();
		
		thinkTime = 0;	
		return events;
	}
	
	public function jump_end() : Array {
		var events = new Array();
		
		if ( lowerClip["midAnimation"] == false ) {
			lowerState = LOWER_MOVE;
			direction = checkDirection();
		}
			
		return events;
	}

	public function checkStateEvents() : Array {
		var events : Array = new Array();
		switch (upperState) {
			case UPPER_BE_HURT :
				if ( upperClip.midAnimation == false) {
					upperState = UPPER_MOVE;
					if ( lowerState != LOWER_BE_HURT ) {
						state = PLAYER_STATE_NORMAL;	
					}
				}
				break;
			case UPPER_SHOOT_SOAP : 
				events = events.concat(fireWeapon());
				break;	
			case UPPER_USE_TRACTOR_BEAM :
				if ( !Key.isDown(altFireButtonCode) ) {
					upperState = UPPER_RELEASE_TRACTOR_BEAM;
					upperClip.gotoAndPlay("use_tractor_beam_end");
					isUsingTractor = false;
					events = events.concat(useTractor());	
				}	
				break;
			case UPPER_TAKE_PHOTO :
				/*if ( fireButtonTime < triggerTractorTime ) {
					if ( canTakePhotograph ) {
						canTakePhotograph = false;
						events.push(new Event(Event.CREATE_CAMERA_FLASH, this, null));
						events = takePhotograph();				
					}
				} else {
					if ( canTakePhotograph ) {
						canTakePhotograph = false;
						upperState = UPPER_RELEASE_TRACTOR_BEAM;
						upperClip.gotoAndPlay("use_tractor_beam_end");
						isUsingTractor = false;
						events = useTractor();	
					}	
				}*/
				events = events.concat(takePhotograph());
				break;		
		}
		/*
		 * case Event.PLAYER_KEY_RELEASED_ALT_FIRE :
					if ( fireButtonTime < triggerTractorTime ) {
						if ( canTakePhotograph ) {
							trace ( "photo");
							canTakePhotograph = false;
							events.push(new Event(Event.CREATE_CAMERA_FLASH, this, null));
							events = takePhotograph();
							trace ("set zero 184");
							fireButtonTime = 0;							
						}
					} else {
						if ( canTakePhotograph ) {
							canTakePhotograph = false;
							upperState = UPPER_RELEASE_TRACTOR_BEAM;
							upperClip.gotoAndPlay("use_tractor_beam_end");
							isUsingTractor = false;
							events = useTractor();	
						}	
					}
					 * 
		 */
		switch (lowerState) {
			case LOWER_BE_HURT :
				if ( lowerClip.midAnimation == false ) {
					lowerState = LOWER_MOVE;	
				}
				if ( upperState != UPPER_BE_HURT ) {
					state = PLAYER_STATE_NORMAL;	
				}
				break;
			case LOWER_JUMP:
				if ( lowerClip["midAnimation"] == false ) {
					events = events.concat(jump_mid());	
				}	
				break;
			case LOWER_ACCELERATE :
				if ( Math.abs(particle.position.x - particle.previousPosition.x) < SAFE_TRAVEL_DISTANCE ) {
					lowerState = LOWER_IDLE;
					lowerClip.gotoAndPlay("idle");	
				} else if ( Math.abs(particle.position.x - particle.previousPosition.x) < (SAFE_TRAVEL_DISTANCE*2) ){
					lowerState = LOWER_MOVE;
					lowerClip.gotoAndPlay("move");	
				}
				break;
			case LOWER_MOVE : 
				if ( Math.abs(particle.position.x - particle.previousPosition.x) < SAFE_TRAVEL_DISTANCE ) {
					lowerState = LOWER_IDLE;
					lowerClip.gotoAndPlay("idle");	
				}
				break;
			case LOWER_JUMP_LAND : 
				if ( lowerClip["midAnimation"] == false ) {
					lowerState = LOWER_MOVE;
					lowerClip.gotoAndPlay("move");
					direction = checkDirection();	
				}
				break;
			case LOWER_IDLE : 
				 
				break;
		}
		
		return events;	
	}


	public function checkKeys() : Array {
//		trace("check keys");
		var events : Array = new Array(); 
		
		// deal with direction keys
		if (!right_down && Key.isDown(Key.RIGHT)) {
			right_down = true;	
		}
		if (!left_down && Key.isDown(Key.LEFT)) {
			left_down = true;	
		}
		if (!up_down && Key.isDown(Key.UP)) {
			up_down = true;	
		}
		if (!down_down && Key.isDown(Key.DOWN)) {
			down_down = true;	
		}
		
		if ( ! (right_down && left_down) ) {
			if ( right_down ) {
				if ( direction == RIGHT ) {
					events.push(new Event( Event.PLAYER_ACCELERATE, this, null ));
				} else {
					if ( checkDirection() == RIGHT) {
						direction = RIGHT;	
						events.push(new Event( Event.PLAYER_ACCELERATE, this, null ));
					}
					events.push(new Event(Event.PLAYER_DECELERATE, this, null ));
				}
			} else if ( left_down ) {
				if ( direction == LEFT ) {
					events.push(new Event( Event.PLAYER_ACCELERATE, this, null ));
				} else {
					if ( checkDirection() == LEFT) {
						direction = LEFT;	
						events.push(new Event( Event.PLAYER_ACCELERATE, this, null ));
					}
					events.push(new Event(Event.PLAYER_DECELERATE, this, null ));
				}
			}	
		}
		if ( up_down ) {
			if ( jumpReady ) {
				events.push(new Event(Event.PLAYER_JUMP_START, this, null ));
			} else {
				//trace(" can't jump");
			}
		} else if ( up_up ) {
			events.push(new Event(Event.PLAYER_KEY_RELEASED_JUMP, this, null ));
			up_up = false;
		}
		
		// now deal with firing
		if ( fire_down ) {
			events.push(new Event(Event.PLAYER_KEY_PRESSED_FIRE, this, null ));
		} else if ( fire_up ) {
			events.push(new Event(Event.PLAYER_KEY_RELEASED_FIRE, this, null ));
			fire_up = false;
		}
		
		// and alt fire
		if ( alt_fire_down ) {
			events.push(new Event(Event.PLAYER_KEY_PRESSED_ALT_FIRE, this, null ));
		} else if ( alt_fire_up ) {
			events.push(new Event(Event.PLAYER_KEY_RELEASED_ALT_FIRE, this, null ));
			alt_fire_up = false;
		}
		
		reset_keys();
		return events;			
	} 
	
	public function reset_keys() : Void {
		alt_fire_down = alt_fire_up = fire_down = fire_up = 
		left_down = left_up = 
		right_down = right_up = 
		up_down = up_up = 
		down_down = down_up = false;				
	}
	
	public function checkDirection() : Number {
		if ( particle.position.x < particle.previousPosition.x ) {
			return LEFT;	
		} else {
			return RIGHT;	
		}
	}
	
	
}
//eof