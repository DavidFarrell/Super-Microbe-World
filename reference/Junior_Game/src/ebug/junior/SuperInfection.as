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
class ebug.junior.SuperInfection extends BadMicrobe {
	var hitTimes : Number;

	public function SuperInfection(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		theGame = inGame;
		particle = inParticle;
		clip = inClip;
		direction = RIGHT;
		particle.physicsExcempt = false;
		particle.isDynamic = true;
		
		state = GameEntity.GAME_ENTITY_STATE_IDLE;
		thinkTime = 0;
		hitTimes = 0;
		lives = 6;
		clip.gotoAndPlay("idle_1");
		colWidth = Math.ceil(clip._width / Constants.TILE_WIDTH); 
		rowHeight = Math.ceil(clip._height / Constants.TILE_WIDTH);
	}
	

	/* 
	 * Superinfection doesn't think, it just sits
	 */
	public function advance() : Array {
		//trace ("sb - state: " + state);
		var debugText = "";;
		
		var events : Array = new Array();	
		thinkTime --;
		
		var think : Boolean = false;
		/*if (thinkTime <= 0) {
			think = true;
			thinkTime = defaultThinkTime;
		}*/
			
		
		if (isOnScreen) {
			switch ( state ) {
				case GameEntity.GAME_ENTITY_STATE_IDLE : 
					if (think) {
						events = idleThink();
					} else {
						events = idle();
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
			}
		}
		return events;
	}
	
	
	public function act(e : Event) : Array {
		//trace ("act si in: " + e.type);
		var events : Array = new Array();	
		var debugText = "";
		/*
		 * most of the time, the event is just THINK
		 * if it is something else, it means we have just started this event
		 */
		switch ( e.type ) {
			case Event.BE_HURT :
				lives --;
				clip.lives = lives;
				hitTimes++;
				
				if ( lives > 0 ) {
					var animation : String = "be_hit_" + hitTimes ;
					if ( hitTimes > 3 ) {
						animation = "be_killed";
					}
					trace ("super animate: " + animation);
					clip.gotoAndPlay(animation);
					state = GameEntity.GAME_ENTITY_STATE_BE_HIT;
				} else if (state != GameEntity.GAME_ENTITY_STATE_BE_KILLED) {
					state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
					clip.gotoAndPlay("be_killed");
				}
				break;
		}
		//trace ("act si out");
		return events;
	}
	
	
	private function beHit() : Array { 
		var events : Array = new Array();		
		
		return events;	
	}
	
	private function beHitThink() : Array {
		trace("be hit think");
		var events : Array = new Array();
		
		state = GameEntity.GAME_ENTITY_STATE_IDLE;
		
		return events;	
	}
	
	private function beKilled() : Array {
		var events : Array = new Array();		
		
		return events;	
	}
	
	private function beKilledThink() : Array {
		var events : Array = new Array();
		if ( clip.midAnimation == false ) { 
			trace ("stopping cause killed");
			clip.stop();
			clip._alpha = 0;
			trace ("superinfection is no longer mid animation so trigger removal");
			//var killEvent : Event = new Event(Event.BE_KILLED, this, null);
			//theGame.entityEvents.push(killEvent);
			/*for ( var i : Number = 0; i < theGame.goals.length; i++) {
				var goal : Goal = theGame.goals[i];
				goal.updateGoal(killEvent);	
			}*/
			events.push(new Event(Event.REMOVE, this, null));
			remove();
			state = GameEntity.GAME_ENTITY_STATE_DEFAULT;
			thinkTime = 9999999;
		}
		return events;	
	}
	
	private function idle() : Array  {
		var events : Array = new Array();		
		return events;	
	}
	
	private function idleThink() : Array {
		var events : Array = new Array();
		return events;
	}
	
	
	public function remove() : Void {
		
			trace ("stopping cause removed");
		clip.stop();
		clip._alpha = 0;
		particle.physicsExcempt = true;
		isOnScreen = false;
		particle.position.x = -100;
		particle.position.y = -100;
		//	delete(particle);
		clip.removeMovieClip();
		clip._visible = false;
	}
	
	
	
}
//eof