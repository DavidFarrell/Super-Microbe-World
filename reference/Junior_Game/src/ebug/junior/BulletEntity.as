import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Vector3;
import ebug.junior.*;
import ebug.ParticleSystem;
import ebug.Constants;

/**
 * @author sbbc231
 */
class ebug.junior.BulletEntity extends GameEntity {
 	public static var BULLET_STATE_NORMAL : Number = 100;
 	public static var BULLET_STATE_SPLAT : Number = 101;
 	public static var BULLET_STATE_DEAD : Number = 102;
 	
 	public static var BULLET_TYPE_SOAP : Number = 0;
 	public static var BULLET_TYPE_BLOOD : Number = 1;
 	
 	
 	public var hurtGood : Boolean;
 	public var hurtBad : Boolean;
 	public var hurtHuman : Boolean;
 	
 	public var damage : Number;
 	public var impactForce : Number;
 	
 	var deadTimer : Number;
 	
 	private var wobbleUp : Number;
 	
	public function BulletEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip, damageGood : Boolean, damageBad : Boolean, damageHuman : Boolean, inDamage : Number, inImpact : Number, inSpeed : Number) {
		super(inGame,inParticle, inClip);
		counterCeiling = 1;
		thinkTime = defaultThinkTime = 3;
		particle.theParent = this;
		
		hurtGood = damageGood;
		hurtBad = damageBad;
		hurtHuman = damageHuman;
		damage = inDamage;
		impactForce = inImpact;
		speed = inSpeed;
		particle.isDynamic = true;
		particle.gravityExcempt = true;
		particle.physicsExcempt = false;
		wobbleUp = -1;
		deadTimer = 15;
		
		clip.gotoAndPlay("shoot");
		state = BULLET_STATE_NORMAL;
	}

	public function advance() : Array {
		var events : Array = new Array();
		
		switch (state) {
			case BULLET_STATE_NORMAL : 
				/*if ( thinkTime <= 0 ) {
					state = BULLET_STATE_SPLAT;
					clip.gotoAndPlay("splat");
				} else {
					particle.force = particle.force.add(new Vector3(( direction * speed ), (wobbleUp * theGame.particleSystem.gravity.y), 0));
				}*/
				if ( deadTimer <=0 ) {
					state = BULLET_STATE_SPLAT;
					clip.gotoAndPlay("splat");
				} else {
					deadTimer--;
				}
				particle.position.x += speed * direction;
				
				if (Math.abs(particle.position.x - particle.previousPosition.x )<= SAFE_TRAVEL_DISTANCE)  {
					thinkTime--;
					if (thinkTime <=0 ) {
						state = BULLET_STATE_SPLAT;
						clip.gotoAndPlay("splat");
					}
				}
				
				break;
			case BULLET_STATE_SPLAT :
				if ( clip["midAnimation"] == false) {
					events.push(new Event(Event.REMOVE, this, null));
					remove();
				}
				break;
			case BULLET_STATE_DEAD : 
				break;
		}	
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = new Array();
		
		switch (state) {
			case BULLET_STATE_NORMAL :
				if (e.type == Event.COLLIDE && e.params[0].type != ebug.Constants.GAME_ENTITY_BULLET && e.params[0].type != ebug.Constants.GAME_ENTITY_PLAYER) {
					state = BULLET_STATE_SPLAT;
					clip.gotoAndPlay("splat");
					var params : Array = new Array();
					params.push(this);
					events.push(new Event(Event.COLLIDE, e.params[0], params));
				}
				break;
		}
		
		
		return events;	
	}
	
	public function remove() : Void {
		particle.physicsExcempt = true;
	//	delete(particle);
		//clip.removeMovieClip();
		clip._visible = false;
		delete(hurtGood);
		delete(hurtBad);
		delete(hurtHuman);
		delete(damage);
		delete(impactForce);
	}
}
//eof