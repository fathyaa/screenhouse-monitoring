--
-- PostgreSQL database dump
--

\restrict fFVuKyBHVfjd0JgpkepWqTyzRsT0fi5oB50ahZTrRygUERyVYFiyJ8MWhboVxm4

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    screenhouse_id integer NOT NULL,
    message text NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sensor_data_id integer,
    sensor_node_id integer
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: districts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.districts (
    id integer NOT NULL,
    regency_id integer NOT NULL,
    name character varying(255) NOT NULL,
    kode character varying(8)
);


ALTER TABLE public.districts OWNER TO postgres;

--
-- Name: districts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.districts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.districts_id_seq OWNER TO postgres;

--
-- Name: districts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.districts_id_seq OWNED BY public.districts.id;


--
-- Name: provinces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provinces (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    kode character varying(2)
);


ALTER TABLE public.provinces OWNER TO postgres;

--
-- Name: provinces_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provinces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.provinces_id_seq OWNER TO postgres;

--
-- Name: provinces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provinces_id_seq OWNED BY public.provinces.id;


--
-- Name: regencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.regencies (
    id integer NOT NULL,
    province_id integer NOT NULL,
    name character varying(255) NOT NULL,
    kode character varying(5)
);


ALTER TABLE public.regencies OWNER TO postgres;

--
-- Name: regencies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.regencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.regencies_id_seq OWNER TO postgres;

--
-- Name: regencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.regencies_id_seq OWNED BY public.regencies.id;


--
-- Name: screenhouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.screenhouses (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    province_id integer NOT NULL,
    regency_id integer NOT NULL,
    district_id integer NOT NULL,
    village_id integer NOT NULL,
    latitude double precision,
    longitude double precision,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    address_detail text,
    owner_user_id integer
);


ALTER TABLE public.screenhouses OWNER TO postgres;

--
-- Name: screenhouses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.screenhouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.screenhouses_id_seq OWNER TO postgres;

--
-- Name: screenhouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.screenhouses_id_seq OWNED BY public.screenhouses.id;


--
-- Name: sensor_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sensor_data (
    id integer NOT NULL,
    nitrogen integer,
    phosphorus integer,
    potassium integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sensor_node_id integer,
    soil_temperature numeric(5,2),
    soil_moisture numeric(5,2),
    soil_ph numeric(4,2),
    conductivity numeric(10,2),
    air_temperature numeric(5,2),
    air_humidity numeric(5,2),
    light_intensity numeric(10,2),
    fan_status boolean DEFAULT false,
    irrigation_status boolean DEFAULT false,
    lamp_status boolean DEFAULT false
);


ALTER TABLE public.sensor_data OWNER TO postgres;

--
-- Name: sensor_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sensor_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sensor_data_id_seq OWNER TO postgres;

--
-- Name: sensor_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sensor_data_id_seq OWNED BY public.sensor_data.id;


--
-- Name: sensor_nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sensor_nodes (
    id integer NOT NULL,
    screenhouse_id integer,
    node_code character varying(50) NOT NULL,
    node_name character varying(100),
    location character varying(255),
    send_interval_seconds integer DEFAULT 60,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sensor_nodes OWNER TO postgres;

--
-- Name: sensor_nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sensor_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sensor_nodes_id_seq OWNER TO postgres;

--
-- Name: sensor_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sensor_nodes_id_seq OWNED BY public.sensor_nodes.id;


--
-- Name: thresholds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thresholds (
    id integer NOT NULL,
    screenhouse_id integer NOT NULL,
    min_nitrogen integer,
    min_soil_moisture integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    max_nitrogen integer,
    min_phosphorus integer,
    max_phosphorus integer,
    min_potassium integer,
    max_potassium integer,
    max_soil_moisture integer,
    min_soil_temperature numeric(5,2),
    max_soil_temperature numeric(5,2),
    min_soil_ph numeric(4,2),
    max_soil_ph numeric(4,2),
    min_conductivity numeric(10,2),
    max_conductivity numeric(10,2),
    min_air_temperature numeric(5,2),
    max_air_temperature numeric(5,2),
    min_air_humidity numeric(5,2),
    max_air_humidity numeric(5,2),
    min_light_intensity numeric(10,2),
    max_light_intensity numeric(10,2)
);


ALTER TABLE public.thresholds OWNER TO postgres;

--
-- Name: thresholds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.thresholds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.thresholds_id_seq OWNER TO postgres;

--
-- Name: thresholds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.thresholds_id_seq OWNED BY public.thresholds.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone_number character varying(30) NOT NULL,
    password text NOT NULL,
    role character varying(50) DEFAULT 'petani'::character varying NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: villages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.villages (
    id integer NOT NULL,
    district_id integer NOT NULL,
    name character varying(255) NOT NULL,
    kode character varying(13)
);


ALTER TABLE public.villages OWNER TO postgres;

--
-- Name: villages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.villages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.villages_id_seq OWNER TO postgres;

--
-- Name: villages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.villages_id_seq OWNED BY public.villages.id;


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: districts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts ALTER COLUMN id SET DEFAULT nextval('public.districts_id_seq'::regclass);


--
-- Name: provinces id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provinces ALTER COLUMN id SET DEFAULT nextval('public.provinces_id_seq'::regclass);


--
-- Name: regencies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regencies ALTER COLUMN id SET DEFAULT nextval('public.regencies_id_seq'::regclass);


--
-- Name: screenhouses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses ALTER COLUMN id SET DEFAULT nextval('public.screenhouses_id_seq'::regclass);


--
-- Name: sensor_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_data ALTER COLUMN id SET DEFAULT nextval('public.sensor_data_id_seq'::regclass);


--
-- Name: sensor_nodes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_nodes ALTER COLUMN id SET DEFAULT nextval('public.sensor_nodes_id_seq'::regclass);


--
-- Name: thresholds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thresholds ALTER COLUMN id SET DEFAULT nextval('public.thresholds_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: villages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.villages ALTER COLUMN id SET DEFAULT nextval('public.villages_id_seq'::regclass);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_kode_key UNIQUE (kode);


--
-- Name: provinces provinces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_kode_key UNIQUE (kode);


--
-- Name: regencies regencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regencies
    ADD CONSTRAINT regencies_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.regencies
    ADD CONSTRAINT regencies_kode_key UNIQUE (kode);


--
-- Name: screenhouses screenhouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT screenhouses_pkey PRIMARY KEY (id);


--
-- Name: sensor_data sensor_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_data
    ADD CONSTRAINT sensor_data_pkey PRIMARY KEY (id);


--
-- Name: sensor_nodes sensor_nodes_node_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_nodes
    ADD CONSTRAINT sensor_nodes_node_code_key UNIQUE (node_code);


--
-- Name: sensor_nodes sensor_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_nodes
    ADD CONSTRAINT sensor_nodes_pkey PRIMARY KEY (id);


--
-- Name: thresholds thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thresholds
    ADD CONSTRAINT thresholds_pkey PRIMARY KEY (id);


--
-- Name: thresholds thresholds_screenhouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thresholds
    ADD CONSTRAINT thresholds_screenhouse_id_key UNIQUE (screenhouse_id);


--
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: villages villages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.villages
    ADD CONSTRAINT villages_kode_key UNIQUE (kode);


--
-- Name: idx_sensor_data_node_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sensor_data_node_created ON public.sensor_data USING btree (sensor_node_id, created_at DESC);


--
-- Name: alerts fk_alert_screenhouse; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fk_alert_screenhouse FOREIGN KEY (screenhouse_id) REFERENCES public.screenhouses(id);


--
-- Name: alerts fk_alert_sensor_data; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fk_alert_sensor_data FOREIGN KEY (sensor_data_id) REFERENCES public.sensor_data(id);


--
-- Name: alerts fk_alert_sensor_node; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fk_alert_sensor_node FOREIGN KEY (sensor_node_id) REFERENCES public.sensor_nodes(id);


--
-- Name: districts fk_district_regency; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT fk_district_regency FOREIGN KEY (regency_id) REFERENCES public.regencies(id);


--
-- Name: regencies fk_regency_province; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regencies
    ADD CONSTRAINT fk_regency_province FOREIGN KEY (province_id) REFERENCES public.provinces(id);


--
-- Name: screenhouses fk_screenhouse_district; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT fk_screenhouse_district FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: screenhouses fk_screenhouse_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT fk_screenhouse_owner FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: screenhouses fk_screenhouse_province; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT fk_screenhouse_province FOREIGN KEY (province_id) REFERENCES public.provinces(id);


--
-- Name: screenhouses fk_screenhouse_regency; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT fk_screenhouse_regency FOREIGN KEY (regency_id) REFERENCES public.regencies(id);


--
-- Name: screenhouses fk_screenhouse_village; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.screenhouses
    ADD CONSTRAINT fk_screenhouse_village FOREIGN KEY (village_id) REFERENCES public.villages(id);


--
-- Name: sensor_data fk_sensor_node; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_data
    ADD CONSTRAINT fk_sensor_node FOREIGN KEY (sensor_node_id) REFERENCES public.sensor_nodes(id);


--
-- Name: thresholds fk_threshold_screenhouse; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thresholds
    ADD CONSTRAINT fk_threshold_screenhouse FOREIGN KEY (screenhouse_id) REFERENCES public.screenhouses(id);


--
-- Name: villages fk_village_district; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.villages
    ADD CONSTRAINT fk_village_district FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- Name: sensor_nodes sensor_nodes_screenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_nodes
    ADD CONSTRAINT sensor_nodes_screenhouse_id_fkey FOREIGN KEY (screenhouse_id) REFERENCES public.screenhouses(id);


--
-- PostgreSQL database dump complete
--

\unrestrict fFVuKyBHVfjd0JgpkepWqTyzRsT0fi5oB50ahZTrRygUERyVYFiyJ8MWhboVxm4

