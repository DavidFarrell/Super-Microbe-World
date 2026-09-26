import ebug.Constants;
import ebug.Entity;
import ebug.Vector3;
import ebug.junior.PlatformGame;
import ebug.Level;
import ebug.junior.*;
import ebug.Tile;

/**
 * @author sbbc231
 */
class ebug.junior.LucyLactobacillus extends GoodMicrobe {
 
	private var slideTimer : Number;
	private var slideTimerDefault : Number;
	
	// TODO reconsider this constructor with the entities array in PlatformGame
	public function LucyLactobacillus(inGame : PlatformGame, inRow:Number, inCol:Number, inParticle:Entity, inClip:MovieClip) {
		super(inGame, inRow, inCol, inParticle, inClip);
	}
	
	public function advance() : Array {
/*		if (this.col <= 4) { 
			trace("("+col+","+row+") ADVANCE state: " + state);
		} 
*/		var debugText = "";;
		
		var events : Array = new Array();	
		thinkTime --;
		
		var think : Boolean = false;
		if ( thinkTime >= 0 ) {
			debugText += " -> advancing to move";
			think = false;
		} else {
			debugText += " -> advancing to think";
			think = true;	
		}
		if (isOnScreen) {
			switch ( state ) {
				case GameEntity.GAME_ENTITY_STATE_WALK :
					if (think) {
						events = walkThink();
					} else {
						events = walk();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_IDLE : 
					if (think) {
						events = idleThink();
					} else {
						events = idle();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_FALL : 
					if (think) {
						events = fallThink();
					} else {
						events = fall();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_SLIDE : 
					slideTimer --;
					if (think) {
						events = slideThink();
					} else {
						events = slide();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED : 
					if (think) {
						events = bePhotographedThink();
					} else {
						events = bePhotographed();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_HIT : 
					if (think) {
						events = beHitThink();
					} else {
						events = beHit();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_KILLED : 
					if (think) {
						events = beKilledThink();
					} else {
						events = beKilled();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_DIVE : 
					if (think) {
						events = diveThink();
					} else {
						events = dive();
					}
					break;
			}
		}
		return events;
	}
	
	public function act(e : Event) : Array {		
		var events : Array = new Array();	
		if (isOnScreen) {
			thinkTime --;
		
			var debugText = "";;
			/*
			 * most of the time, the event is just THINK
			 * if it is something else, it means we have just started this event
			 */
			switch ( e.type ) {
				case Event.THINK :
						thinkTime++;
						events = advance();
					break;
	
				case Event.WALK :
					state = GameEntity.GAME_ENTITY_STATE_WALK;
					direction = e.params[0];
					clip.gotoAndPlay("walk");
					
					thinkTime = 0;
					events = advance();
					break;
					
				case Event.IDLE :
					state = GameEntity.GAME_ENTITY_STATE_IDLE;
					clip.gotoAndPlay("idle");
					thinkTime = e.params[0];
					
					events = advance();
					break;
					
				case Event.FALL :
					state = GameEntity.GAME_ENTITY_STATE_FALL;
					counterCeiling = 3;
					counter = counterCeiling;
					clip.gotoAndPlay("fall");
					
					events = advance();				
					break;
					
				case Event.COLLIDE :
					if (state != GameEntity.GAME_ENTITY_STATE_FALL && state != GameEntity.GAME_ENTITY_STATE_SLIDE 
					 && state != GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED && state != GameEntity.GAME_ENTITY_STATE_BE_HIT 
					 && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED && state != GoodMicrobe.GAME_ENTITY_STATE_DIVE) {
						if (e.params[0] instanceof BadMicrobe ) {
							var params : Array = new Array();
							params.push (1);
							events.push( new Event(Event.BE_HURT, this, params)); 
						
							state = GameEntity.GAME_ENTITY_STATE_SLIDE;
							slideTimer = slideTimerDefault;
							particle.physicsExcempt = false;
							counterCeiling = 10;
							counter = counterCeiling;
						}  else if ( e.params[0].type == Constants.GAME_ENTITY_MILK ) {
							particle.physicsExcempt = true;
							particle.isDynamic = false;
							state = GoodMicrobe.GAME_ENTITY_STATE_DIVE;
							clip.gotoAndPlay("dive");
						} else {
							state = GameEntity.GAME_ENTITY_STATE_SLIDE;
							clip.gotoAndPlay("slide");
							
							slideTimer = slideTimerDefault;
							particle.physicsExcempt = false;
							counterCeiling = 10;
							counter = counterCeiling;
						}
						events = events.concat(advance());
					}
					break;
				case Event.BE_HURT :
					lives -= e.params[0];
					clip.gotoAndPlay("be_hit");
					state = GameEntity.GAME_ENTITY_STATE_BE_HIT;
						
					if ( lives <=0 ) {
						events.push( new Event(Event.BE_KILLED, this, params));
						clip.gotoAndPlay("be_killed");	
					}
					break;
				case Event.BE_KILLED :
					state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
					
					break;				
				case Event.BE_PHOTOGRAPHED :
					if ( !hasBeenPhotographed ) {
						hasBeenPhotographed = true;
						state = GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED;
						clip.gotoAndPlay("be_photographed");
						thinkTime = defaultThinkTime;
						particle.physicsExcempt = true;
						events = advance();
					}
				
					
					break;
			}
		}
		return events;
	}
	
	
	private function dive() : Array {
		var events : Array = new Array();		
		
		//particle.position.y += 55;
		clip._alpha -=5;
		return events;	
	}
	
	private function diveThink() : Array {
		var events : Array = new Array();
		if ( clip._alpha <=10 ) {
			events.push(new Event(Event.REMOVE, this, null));
			particle.physicsExcempt = true;
			isOnScreen = false;
			remove();
			state = GameEntity.GAME_ENTITY_STATE_IGNORE;
			//events.push(new Event(Event.BE_KILLED, this, null));
		}
		thinkTime = defaultThinkTime;
		return events;	
	}
}
//eof