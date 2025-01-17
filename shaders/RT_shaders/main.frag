#version 460 core
layout(rgba16f, binding = 0) uniform image2D screen;
out vec4 FragColor;
in vec4 gl_FragCoord;

#define FLT_MAX 999999
#define SPHERE_COUNT 2

int MaxBounceCount = 50;
int Samples = 50;

struct Material
{
    vec4 albido;
    float roughness;
    vec4 emissionColor;
    float emissionStrength;
};

struct Sphere
{
	vec3 center;
	float radius;
    Material mat;
};


uniform vec2 u_resolution;
uniform Sphere u_spheres[SPHERE_COUNT];
uniform Sphere u_light;
uniform float u_time;
uniform sampler2D u_texture;
uniform float u_show;

in vec2 texCoord;

// -1 to 1
float rand(float seed)
{
	return 2 * fract(sin(seed)*999999.0) - 1;
}

float rand01(float seed) { return 2 * fract(sin(seed)*43758.5453123) - 1; }
vec3 randomInsideUnitSphere(vec3 rayDir,vec3 rayPos, float extraSeed)
{
    return vec3(rand01(u_time * (rayDir.x + rayPos.x + 0.357) * extraSeed),
                rand01(u_time * (rayDir.y + rayPos.y + 16.35647) *extraSeed),
                rand01(u_time * (rayDir.z + rayPos.z + 425.357) * extraSeed));
}

struct HitInfo
{
    bool didHit;
    float dst;
    vec3 hitPoint;
    vec3 normal;
    Material mat;
};

struct Ray
{
	vec3 origin;
	vec3 direction;
};

struct Camera
{
    vec3 origin;
    float fov;
};

vec3 RayAt(Ray ray, float t)
{	
	return ray.origin + t * ray.direction;
}

HitInfo RaySphere(Ray ray, Sphere sphere)
{
    HitInfo hitInfo;
    hitInfo.didHit = false;

    vec3 offsetRayOrigin = ray.origin - sphere.center;

    float a = dot(ray.direction, ray.direction);
    float b = 2 * dot(offsetRayOrigin, ray.direction);
    float c = dot(offsetRayOrigin, offsetRayOrigin) - sphere.radius * sphere.radius;

    float discriminant = b * b - 4 * a * c;
    if (discriminant >= 0)
    {
        float dst = (-b - sqrt(discriminant)) / (2.0 * a);

        if (dst >= 0)
        {
            hitInfo.didHit = true;
            hitInfo.dst = dst;
            hitInfo.hitPoint = ray.origin + ray.direction * dst;
            hitInfo.normal = normalize(hitInfo.hitPoint - sphere.center);
            hitInfo.hitPoint = ray.origin + ray.direction * dst + hitInfo.normal * 0.0001;

        }
    }

    return hitInfo;
}


HitInfo CalculateRayCollision(Ray ray)
{
    HitInfo closestHit;
    closestHit.dst = FLT_MAX;

    for (int i = 0; i < SPHERE_COUNT; i++)
    {
        Sphere sphere = u_spheres[i];
        HitInfo hitInfo = RaySphere(ray, sphere);

        if (hitInfo.didHit && hitInfo.dst < closestHit.dst)
        {
            closestHit = hitInfo;
            closestHit.mat = sphere.mat;
        }
    }

    return closestHit;
}

vec4 BackgroundColor(Ray ray)
{
	vec3 unit_direction = normalize(ray.direction);
    float t = 0.5*(unit_direction.y + 1.0);
    return (1.0-t)*vec4(1.0, 1.0, 1.0, 1.0) + t*vec4(0.5, 0.7, 1.0, 1.0);
}

vec4 Trace(Ray ray)
{
    vec4 incomingLight = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 rayColor = vec4(1, 1, 1, 1);
    Ray newRay = ray;
    HitInfo firstHitInfo = CalculateRayCollision(ray);
    if (!firstHitInfo.didHit)
    {
        return BackgroundColor(ray);
    }

    for (int i = 0; i <= MaxBounceCount; i++)
    {   
        HitInfo hitInfo = CalculateRayCollision(newRay);
        if (hitInfo.didHit)
        {
            Material material = hitInfo.mat;
            newRay.origin = hitInfo.hitPoint;
            vec3 random2 = randomInsideUnitSphere(newRay.direction, newRay.origin, gl_FragCoord.y + gl_FragCoord.x);
            newRay.direction = reflect(newRay.direction, hitInfo.normal + material.roughness * random2);

            vec4 emittedLight = material.emissionColor * material.emissionStrength;
            float lightStrengh = dot(newRay.direction, hitInfo.normal);
            incomingLight += (emittedLight * rayColor) / Samples;
            rayColor *= material.albido; //* lightStrengh * 2.0;
        }
        else 
        {
            break;
        }
    }

    return incomingLight * 50;
}

void main()
{
	float aspectRatio = u_resolution.x / u_resolution.y;
	float x = -(float(gl_FragCoord.x * 2 - u_resolution.x) / u_resolution.x) * aspectRatio; // transforms to [-1.0, 1.0]
	float y = -(float(gl_FragCoord.y * 2 - u_resolution.y) / u_resolution.y);               // transforms to [-1.0, 1.0]

    Camera cam;
    cam.fov = 90.0;
    cam.origin = vec3(0.0, 0.0, -tan(cam.fov / 2.0));

    Ray ray;
    ray.origin = cam.origin;
    ray.direction = -normalize(vec3(x, y, 0.0) - cam.origin);

    FragColor = Trace(ray);
}