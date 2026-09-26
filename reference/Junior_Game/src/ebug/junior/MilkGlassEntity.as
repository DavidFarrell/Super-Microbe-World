import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Constants;
import ebug.junior.*;
import ebug.ParticleSystem;

/**
 * @author sbbc231
 * this entity reacts to contact with lactobacillus entitities. 
 * when sufficient contacts have occurred, it turns to yogurt.
 */
class ebug.junior.MilkGlassEntity extends GameEntity {
	// entity states
	public static var WHITE_STATUS : Number = 100;
	public static var FLASHING_STATUS : Number = 101;
	public static var YOGURT_STATUS : Number = 102;
	
	// entity events
	public static var MILK_GLASS_EVENT_HIT : Number = 50;


	public function MilkGlassEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		super(inGame,inParticle, inClip);
		counterCeiling = 1;
		thinkTime = 0;
		particle.theParent = this;
		particle.physicsExcempt = false;
		particle.isDynamic = true;
		state = WHITE_STATUS;
		clip.stop();
		defaultThinkTime = 9999999;
		type = Constants.GAME_ENTITY_MILK;
	}

	public function advance() : Array {
		//trace ("thinking milk" + particle.isDynamic);
		var events : Array = new Array();
		if (thinkTime <= 0) {
			switch (state) {
				case FLASHING_STATUS : 
				//trace ("flashing, animation mid == " + clip.midAnimation);
					if ( clip.midAnimation == false ) {
						if ( counter == counterCeiling) {
							state = YOGURT_STATUS;
							clip.gotoAndPlay("yogurt");
							thinkTime = defaultThinkTime;
										
						} else {
							state = WHITE_STATUS;
							clip.gotoAndPlay("start");
							thinkTime = defaultThinkTime;
						}
					}
					break;
			}
		}
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = new Array();
		//trace (" acting on event: " + e.type );
		switch (e.type) {
			case Event.COLLIDE:
				if (e.params[0].type == Constants.GAME_ENTITY_LUCY) {
					var lucy : LucyLactobacillus = LucyLactobacillus(e.params[0]);
					if (lucy.state != GameEntity.GAME_ENTITY_STATE_DIVE) {
						var hitEvent = new Event(MILK_GLASS_EVENT_HIT, this, null);
						events.push(hitEvent);
					}
				} 
				break;
			case MILK_GLASS_EVENT_HIT :
			//	trace ( "Glass hit by lucy - state ("+state+")");
				if (state == WHITE_STATUS ) {
					clip.gotoAndPlay("tickle");
					counter ++;
					
					if ( counter == counterCeiling ) {
						var yogEvent : Event = new Event(Event.MILK_GLASS_EVENT_TURN_TO_YOGURT, this, null);
						events.push(yogEvent);	
					}
					
					state = FLASHING_STATUS;
					thinkTime = 0;
					
					var params = new Array();
					params.push(10);
					trace("Give player 10 points for getting a lucy to the glass");	
					var pointsEvent : Event = new Event(Event.MODIFY_POINTS, null, params);
					events.push(pointsEvent);
				}
				break;
			case Event.MILK_GLASS_EVENT_TURN_TO_YOGURT :
				// the milk glass doesn't need to do anything once it is yogurt - but may do later
				break;				
		}
		return events;	
	}
	
	public function remove() : Void {
		particle.gravityExcempt = true;
		this.isOnScreen = false;
		this.defaultThinkTime = 9999999;
		this.thinkTime = defaultThinkTime;
		state = GameEntity.GAME_ENTITY_STATE_DEFAULT;
		
		//delete(particle);
		clip.removeMovieClip();
	}
}
//eof